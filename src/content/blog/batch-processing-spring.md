---
title: "Día 8: El usuario subió un Excel y tu servidor pidió perdón"
description: "HTTP no fue diseñado para operaciones de minutos. Batch processing, async patterns y cómo dejar de torturar a tus usuarios. Día 8 de #100ArchitectureDays."
tags: ["Java", "Spring Boot", "Architecture", "100ArchitectureDays"]
date: 2026-04-08
readTime: "8 min read"
image: "/blog/batch-processing-spring.webp"
day: 8
---

El usuario sube un Excel con 500.000 filas. Tu endpoint lo lee, lo procesa, y le devuelve el resultado. Sincrónicamente. En el mismo thread del request HTTP.

El browser muestra "esperando respuesta del servidor" durante 4 minutos. El load balancer corta por timeout a los 60 segundos. La app se come 2GB de memoria. El pod se reinicia. El usuario vuelve a intentar. Y así tres veces.

Si esto te suena familiar, seguí leyendo.

## HTTP no fue diseñado para esto

Antes de hablar de código, necesitamos hablar de algo más fundamental: **HTTP es un protocolo de request-response diseñado para respuestas rápidas**. Millisegundos, tal vez segundos. No minutos.

Cuando metés una operación de 4 minutos dentro de un request HTTP, estás peleando contra todo el stack:

- El **load balancer** tiene un timeout (generalmente 60 segundos)
- El **proxy** tiene un timeout
- El **browser** tiene un timeout
- La **conexión TCP** tiene un timeout
- Tu **thread pool** tiene un límite de threads

Todo conspira contra vos. Y no es un bug — es que estás usando la herramienta equivocada para el trabajo.

Es como mandar un paquete de 200 kilos por correo postal. Técnicamente podrías. Pero no fue diseñado para eso. Necesitás un flete.

## El patrón universal: recibí, encolá, procesá, notificá

La solución no es "hacer que tarde menos". La solución es **cambiar la arquitectura**. Y el patrón es el mismo en cualquier lenguaje:

```
1. RECIBIR  → Aceptar el request, validar lo básico
2. ENCOLAR  → Generar un ID de job, responder inmediatamente
3. PROCESAR → En background, en batches, con progreso
4. NOTIFICAR → El usuario consulta el estado o recibe una notificación
```

Esto existe en todos lados:

- **Python/Django**: Celery + Redis como broker
- **Node.js**: Bull/BullMQ con Redis, o AWS SQS
- **Go**: Goroutines + channels, o temporal.io para workflows complejos
- **Ruby/Rails**: Sidekiq
- **Java/Spring**: `@Async` + ThreadPoolExecutor, o Spring Batch para escenarios pesados
- **.NET**: Hangfire, o Azure Functions

La herramienta cambia. El patrón es idéntico: **no proceses en el thread del request HTTP**.

## El crimen contra la arquitectura

Mirá este endpoint. Parece inocente. Es un desastre:

```java
@PostMapping("/importar")
public ResponseEntity<String> importar(@RequestParam MultipartFile archivo) {
    List<Registro> registros = parser.parsear(archivo); // 500K filas en memoria
    for (Registro r : registros) {
        validar(r);
        transformar(r);
        guardar(r);               // 500K INSERTs, uno por uno
    }
    return ResponseEntity.ok("Listo");
}
```

Contemos los problemas:

1. **Todo en memoria**: 500K objetos Java. Si cada uno pesa 1KB, son 500MB solo en datos. Más los objetos temporales, fácilmente llegás a 2GB.
2. **Todo secuencial**: un registro a la vez. Si cada INSERT tarda 2ms, son 1000 segundos. Más de 16 minutos.
3. **Todo síncrono**: el usuario espera con el browser abierto. El thread HTTP queda bloqueado.
4. **Cero feedback**: el usuario no sabe si va por el registro 100 o el 499.999.
5. **Todo o nada**: si falla en la fila 499.999, ¿perdiste todo? ¿Hacés rollback de 499.998 registros?

## La versión que respeta al usuario (y al servidor)

### Paso 1: Recibí y respondé inmediatamente

```java
@PostMapping("/importar")
public ResponseEntity<ImportacionResponse> importar(
        @RequestParam MultipartFile archivo) {

    String jobId = importacionService.encolar(archivo);

    return ResponseEntity.accepted().body(
        new ImportacionResponse(jobId, "PROCESANDO",
            "/importaciones/" + jobId + "/estado")
    );
}
```

El usuario sube el archivo y en menos de un segundo recibe un ID de trabajo y una URL para consultar el progreso. No espera. No hay timeout. No hay pantalla de "cargando" durante 4 minutos.

**HTTP 202 Accepted** — "recibí tu pedido, te aviso cuando esté". Ese es el status code correcto para operaciones asíncronas. No 200. No 201. **202**.

### Paso 2: Procesá en background por batches

```java
@Async("importacionExecutor")
public void procesar(String jobId, Path archivoPath) {
    Importacion importacion = repository.findByJobId(jobId);
    importacion.setEstado("EN_PROGRESO");

    try (Stream<Registro> registros = parser.stream(archivoPath)) {
        List<Registro> batch = new ArrayList<>(1000);
        int procesados = 0;

        for (Registro r : registros) {
            try {
                batch.add(transformar(validar(r)));
            } catch (ValidationException e) {
                importacion.incrementarErrores();
            }

            if (batch.size() >= 1000) {
                repository.saveAll(batch);  // UN saveAll cada 1000
                batch.clear();
                procesados += 1000;
                importacion.setProcesados(procesados);
                repository.save(importacion);
            }
        }

        // Guardar ultimo batch parcial
        if (!batch.isEmpty()) {
            repository.saveAll(batch);
        }

        importacion.setEstado("COMPLETADO");
    } catch (Exception e) {
        importacion.setEstado("ERROR");
    }
    repository.save(importacion);
}
```

Tres cosas clave cambiaron:

1. **Stream en vez de lista**: no cargás 500K filas en memoria. Las leés de a poco. En Python es un generator. En Node es un readable stream. En Go es un scanner.
2. **Batches de 1000**: en vez de un INSERT por fila, hacés un `saveAll` cada 1000 registros. La base de datos te lo agradece — un bulk insert de 1000 es *mucho* más rápido que 1000 inserts individuales.
3. **Progreso persistido**: el usuario puede consultar cuántas filas se procesaron y cuántas fallaron. Sin adivinar.

### Paso 3: Configurá el thread pool

```java
@Bean("importacionExecutor")
public Executor importacionExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(2);
    executor.setMaxPoolSize(4);
    executor.setQueueCapacity(10);
    executor.setThreadNamePrefix("import-");
    executor.setRejectedExecutionHandler(
        new ThreadPoolExecutor.CallerRunsPolicy()
    );
    return executor;
}
```

**No uses el executor por defecto.** Si no configurás un pool, Spring crea un thread nuevo por cada tarea. Con 50 usuarios subiendo archivos a la vez, tenés 50 threads compitiendo por CPU y memoria. Eso no escala.

El `CallerRunsPolicy` es elegante: si la cola está llena, en vez de tirar un error, ejecuta la tarea en el thread del caller. Funciona como back-pressure natural. "Estoy ocupado, hacelo vos."

## Decile al usuario qué está pasando

La UX importa tanto como la arquitectura. El peor error es dejar al usuario adivinando.

```json
{
  "jobId": "abc-123",
  "estado": "EN_PROGRESO",
  "totalRegistros": 500000,
  "procesados": 125000,
  "errores": 42,
  "porcentaje": 25,
  "tiempoEstimado": "3 minutos"
}
```

El frontend hace polling cada 5 segundos (o mejor: usa WebSocket/SSE) y muestra una barra de progreso real. El usuario ve que algo está pasando. No se pone ansioso. No recarga la página. No genera requests duplicados.

Esto aplica a cualquier framework y cualquier frontend. La respuesta JSON con progreso es universal.

## La regla de los tres tiempos

Si tu operación tarda **segundos**, puede ser síncrona. Respondé en el request, nadie se queja.

Si tarda **minutos**, tiene que ser asíncrona. Recibí, encolá, procesá en background, notificá.

Si tarda **horas**, necesitás un sistema de colas dedicado (RabbitMQ, SQS, Kafka) o un framework de batch processing (Spring Batch, Celery, Temporal). Y probablemente necesitás retry, dead letter queue, y monitoreo.

No es una cuestión de elegancia. Es que **HTTP no fue diseñado para operaciones de larga duración**. El timeout del load balancer, el timeout del browser, el timeout del proxy — todo te va a explotar en la cara si intentás forzar una operación de minutos en un protocol de milisegundos.

## Cuándo NO usar async

- **Operaciones que tardan menos de 5 segundos** — La complejidad del async no se justifica. Dejalo síncrono.
- **Cuando el usuario necesita el resultado para continuar** — Si el paso siguiente depende del resultado, async no ayuda. El usuario va a quedarse esperando igual, pero haciendo polling.
- **Sin infraestructura para monitoreo** — Los jobs async que fallan silenciosamente son un clásico de terror. Si no podés ver los jobs fallidos, estás volando a ciegas.
- **Con archivos pequeños** — 100 registros no justifican toda esta maquinaria. Procesalos síncrono, respondé en 200ms, y seguí con tu vida.

## Esto es el Día 8

Este artículo es parte de **#100ArchitectureDays** — una serie de problemas reales de arquitectura con soluciones reales. Si tu endpoint tiene un timeout de 4 minutos, no necesitás un timeout más largo. Necesitás otra arquitectura.

Y lo más importante: tratá al usuario como adulto. Decile "esto tarda 3 minutos" y mostrále el progreso. Es mil veces mejor que una pantalla en blanco con un spinner eterno.

Seguí la saga completa en **#100ArchitectureDays**.

Todo el código está en [GitHub](https://github.com/alafourcadev/100-architecture-days). Si te está sirviendo, dejame una estrella — es gratis y ayuda a que más gente lo encuentre.
