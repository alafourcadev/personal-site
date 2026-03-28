---
title: "Día 1: Tu app tarda 11 segundos en arrancar y vos pensás que es normal"
description: "De 10.7s a 1.3s de startup. El problema no es Spring Boot — es cómo inicializás tus servicios. Día 1 de #100ArchitectureDays."
tags: ["Java", "Spring Boot", "Architecture", "100ArchitectureDays"]
date: 2026-03-26
readTime: "8 min read"
image: "/blog/cold-start-spring-boot.webp"
day: 1
---

Tu PM te mira con cara de "¿y ahora?" porque el health check tarda una eternidad. El pod se reinicia en Kubernetes. El usuario ve una pantalla en blanco. Y vos, mientras tanto, mirando los logs pensando que "es normal que Spring levante lento".

No. No es normal. Y el problema no es Spring Boot.

## El problema real

Abrí tu servicio principal. Buscá los `@PostConstruct`. Contá cuántas operaciones bloqueantes metiste ahí. Te espero.

Lo que la mayoría de los equipos hacen es confundir **"la app está lista"** con **"todo está inicializado"**. Son dos cosas completamente diferentes.

Tu usuario no necesita que la sincronización con el proveedor esté completa para ver una pantalla de login. No necesita que el warehouse esté validado para navegar el catálogo. Pero vos le estás diciendo "esperá 11 segundos a que yo termine de hacer cosas que ni te importan".

## El clásico: todo bloqueante en el arranque

Mirá este servicio. Decime si no te resulta familiar:

```java
@Service
public class BlockingProductService implements ProductService {

    private final ProductRepository repository;

    public BlockingProductService(ProductRepository repository) {
        this.repository = repository;
    }

    @PostConstruct
    public void initialize() {
        syncWithSupplierAPI();   // 5 segundos - BLOQUEA
        validateWarehouse();      // 3 segundos - BLOQUEA
        initializeProducts();     // 1 segundo  - BLOQUEA
    }

    @Override
    public List<Product> findAll() {
        return repository.findAll();
    }
}
```

`@PostConstruct` se ejecuta **durante** la creación del bean. Spring no termina de levantar hasta que ese método complete. Así que tu app se queda ahí, trabada, 5 + 3 + 1 = 9 segundos solo en este servicio. Sumale el resto del contexto y llegás fácil a los 10.7 segundos.

El problema no es que esas operaciones sean lentas. El problema es que **las estás ejecutando en el peor momento posible**: cuando el usuario está esperando.

## La solución: dejá de bloquear el startup

```java
@Service
public class AsyncProductService implements ProductService {

    private final ProductRepository repository;

    public AsyncProductService(ProductRepository repository) {
        this.repository = repository;
    }

    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void initializeAsync() {
        syncWithSupplierAPI();   // 5s - background
        validateWarehouse();      // 3s - background
        initializeProducts();     // 1s - background
    }

    @Override
    public List<Product> findAll() {
        return repository.findAll();
    }
}
```

Dos anotaciones. Eso es todo.

`@EventListener(ApplicationReadyEvent.class)` le dice a Spring: "ejecutá esto **después** de que la app ya esté lista y respondiendo". Y `@Async` lo manda a un thread separado para que no bloquee nada.

No te olvides de agregar `@EnableAsync` en tu clase principal:

```java
@SpringBootApplication
@EnableAsync
public class MyApplication {
    public static void main(String[] args) {
        SpringApplication.run(MyApplication.class, args);
    }
}
```

## Los números

| | ANTES | DESPUÉS | Mejora |
|---|---|---|---|
| Startup | 10.7s | 1.3s | **88%** |

No es un 5%. No es un 20%. Es un **88% de reducción en el tiempo de arranque**. Tu app responde en 1.3 segundos en lugar de casi 11.

Eso es la diferencia entre que Kubernetes piense que tu pod está muerto y lo reinicie en un loop, o que el health check pase sin drama.

## ¿Por qué funciona?

El patrón se llama **Deferred Initialization** y la idea es brutalmente simple:

```
ANTES:  App Startup → [Operaciones Pesadas BLOQUEAN] → App Ready (10.7s)
DESPUÉS: App Startup → App Ready (1.3s) → [Operaciones en Background]
```

Movés las operaciones pesadas a **después** del startup. La app ya está lista para recibir requests. El health check pasa. Kubernetes está contento. El usuario ve algo en pantalla. Y mientras tanto, en background, tus sincronizaciones y validaciones se ejecutan tranquilas.

Es como abrir un restaurante: no esperás a que todos los platos estén preparados para dejar entrar a la gente. Abrís las puertas, sentás a los clientes, y la cocina va trabajando.

## ¿Cuándo NO hacer esto?

Antes de que salgas a ponerle `@Async` a todo, pará un segundo. Hay casos donde la inicialización **tiene que ser bloqueante**:

- **Migraciones de base de datos.** Si tu app necesita un schema actualizado para funcionar, no podés diferirlo. Flyway y Liquibase se ejecutan en el startup por una buena razón.
- **Configuración crítica de seguridad.** Cargar certificados, inicializar keystores, configurar OAuth. Si tu app empieza a recibir requests sin esto, tenés un problema de seguridad.
- **Cache que es requisito para responder.** Si tu endpoint devuelve datos que vienen exclusivamente del cache y el cache está vacío, vas a devolver respuestas vacías o errores.
- **Validaciones de infraestructura.** Verificar que la base de datos esté accesible, que las colas de mensajes existan. Si esto falla, la app no debería reportarse como healthy.

La regla es simple: **si la app puede responder requests útiles sin que esa operación haya terminado, diferila. Si no puede, dejala bloqueante.**

No es lazy loading por default. Es pensar críticamente qué necesitás para arrancar y qué puede esperar.

## El error de fondo

El verdadero problema no es técnico. Es de mentalidad.

Tratamos el startup como un "momento de preparar todo" cuando en realidad debería ser un "momento de estar disponible lo antes posible". En un mundo de containers, autoscaling y deploys continuos, cada segundo de cold start es un segundo donde tus usuarios ven un error 503.

Y lo peor: la solución es trivial. Dos anotaciones. Cero librerías nuevas. Cero cambios de arquitectura. Solo pensar un segundo antes de meter un `Thread.sleep` (o su equivalente real: una llamada HTTP, una query pesada, una sincronización) dentro de un `@PostConstruct`.

## Esto es solo el Día 001

Este artículo es parte de **#100ArchitectureDays** — una serie de 110 problemas reales de arquitectura con soluciones reales. No teoría. No diagramas bonitos que nadie implementa. Código que podés clonar, correr, y ver los resultados vos mismo.

Si tu app tarda más de 3 segundos en arrancar, tenés tarea para hoy.

Seguí la saga completa en **#100ArchitectureDays**.
