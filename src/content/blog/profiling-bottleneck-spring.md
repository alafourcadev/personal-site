---
title: "Día 7: ¿Quién te mandó a optimizar si ni siquiera mediste?"
description: "Optimizás a ciegas porque nunca mediste. Profiling con Actuator y Micrometer para encontrar el cuello de botella real. Día 7 de #100ArchitectureDays."
tags: ["Java", "Spring Boot", "Architecture", "100ArchitectureDays"]
date: 2026-04-07
readTime: "7 min read"
image: "/blog/profiling-bottleneck-spring.webp"
day: 7
---

Después del post del Día 6 sobre caché, un amigo me escribió: "Ale, leí tu artículo y me puse a optimizar todo. Moví queries a vistas materializadas, metí un CDN, cambié el serializer de JSON. La app sigue tardando 3 segundos."

Le pregunté: "¿Y mediste dónde está el cuello de botella?"

Silencio.

"¿Al menos sabés cuál de los 4 servicios que llama tu endpoint es el lento?"

Más silencio.

Ahí le dije lo que te voy a decir a vos: **¿quién te mandó a optimizar si ni siquiera mediste?**

## Optimización ciega: el error que todos cometemos

Todos conocemos la frase de Knuth: "la optimización prematura es la raíz de todos los males." Pero hay un primo hermano igual de peligroso: la **optimización ciega**.

"Seguro es la base de datos." No mediste. "Debe ser la serialización JSON." No mediste. "El servicio externo tarda mucho." Tampoco mediste.

Y así terminás optimizando cosas que tardan 2ms mientras el verdadero culpable — un servicio que tarda 3.2 segundos — sigue ahí, invisible, arruinándote la vida.

## El caso de mi amigo

Mirá el endpoint que me mandó. Tarda 3.3 segundos y nadie sabe por qué:

```java
@RestController
public class PedidoController {

    @GetMapping("/pedidos/{id}")
    public PedidoDTO obtenerPedido(@PathVariable Long id) {
        Pedido pedido = pedidoService.buscar(id);           // ¿cuánto tarda?
        Cliente cliente = clienteService.buscar(pedido.getClienteId()); // ¿cuánto?
        List<Producto> productos = productoService
            .buscarPorIds(pedido.getProductoIds());          // ¿cuánto?
        BigDecimal descuento = descuentoService
            .calcular(cliente, productos);                   // ¿cuánto?

        return PedidoDTO.from(pedido, cliente, productos, descuento);
    }
}
```

Cuatro llamadas. ¿Cuál es la lenta? No tenés idea. Y sin datos, estás tirando dardos con los ojos vendados.

## Paso 1: Actuator te muestra lo que no ves

Agregá las dependencias:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

Configurá los endpoints:

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health, metrics, prometheus
  metrics:
    tags:
      application: mi-ecommerce
```

Con esto ya tenés `/actuator/metrics` expuesto. Podés ver cuánto tardan tus endpoints, cuántas conexiones a la base de datos estás usando, el estado del thread pool, la memoria. Todo.

## Paso 2: Micrometer te dice exactamente dónde duele

Ahora instrumentá el código que sospechás:

```java
@Service
public class PedidoService {

    private final MeterRegistry registry;
    private final PedidoRepository repository;

    public PedidoService(MeterRegistry registry, PedidoRepository repository) {
        this.registry = registry;
        this.repository = repository;
    }

    public Pedido buscar(Long id) {
        return registry.timer("pedido.buscar").record(() ->
            repository.findById(id).orElseThrow()
        );
    }
}
```

Hacé lo mismo con cada servicio. Ahora cuando consultás `/actuator/metrics/pedido.buscar` ves:

```json
{
  "name": "pedido.buscar",
  "measurements": [
    { "statistic": "COUNT", "value": 1523 },
    { "statistic": "TOTAL_TIME", "value": 2.41 },
    { "statistic": "MAX", "value": 0.008 }
  ]
}
```

2.41 segundos en total, 1523 llamadas, máximo 8ms. Este servicio no es el problema.

Ahora mirás `descuento.calcular`:

```json
{
  "name": "descuento.calcular",
  "measurements": [
    { "statistic": "COUNT", "value": 1523 },
    { "statistic": "TOTAL_TIME", "value": 4562.7 },
    { "statistic": "MAX", "value": 3.2 }
  ]
}
```

4562 segundos acumulados. Máximo 3.2 segundos por llamada. **Ahí está tu cuello de botella.**

Resulta que el servicio de descuentos llama a una API externa que tarda un promedio de 3 segundos. Pero nadie lo sabía porque nadie midió.

## Paso 3: @Timed para no ensuciar el código

Si no querés meter `registry.timer()` en cada método, usá la anotación:

```java
@Service
public class DescuentoService {

    @Timed(value = "descuento.calcular",
           description = "Tiempo de cálculo de descuentos",
           percentiles = {0.5, 0.95, 0.99})
    public BigDecimal calcular(Cliente cliente, List<Producto> productos) {
        // tu lógica
    }
}
```

Los percentiles te dan información mucho más útil que el promedio. El p95 de 3.2 segundos te dice que el 5% de tus usuarios esperan más de 3 segundos. El promedio de 300ms te mentiría.

No te olvides de registrar el aspect:

```java
@Bean
public TimedAspect timedAspect(MeterRegistry registry) {
    return new TimedAspect(registry);
}
```

## El waterfall real

Una vez que medís todo, el panorama se ve así:

```
pedido.buscar        ████  8ms
cliente.buscar       ██████  15ms
producto.buscarIds   ████████  22ms
descuento.calcular   ████████████████████████████████████████  3200ms
                     |--- Aquí está el 98% del tiempo ---|
```

Sin medir, hubieras cacheado `producto.buscarIds` (22ms) pensando que era el culpable. Con datos, sabés exactamente qué atacar.

## La solución al cuello de botella real

Ahora que sabés que `descuento.calcular` es el problema, podés tomar decisiones informadas:

- ¿Se puede cachear el resultado del descuento? Sí, si los descuentos no cambian por cada request.
- ¿Se puede hacer la llamada async? Sí, si podés mostrar el pedido sin el descuento y cargarlo después.
- ¿Se puede reemplazar la API externa? Quizás, internalizando las reglas de descuento.

**La decisión correcta sale de los datos, no de la intuición.**

## Cuándo NO hacer profiling

- **En producción sin cuidado** — Las métricas consumen recursos. Micrometer es liviano, pero si instrumentás cada línea de cada método vas a generar overhead. Medí lo que importa.
- **Con datos de desarrollo** — Tu máquina local con 3 registros no reproduce un problema de producción con 3 millones. Hacé profiling con datos representativos.
- **Para micro-optimizaciones** — Si tu endpoint tarda 50ms en total y querés bajar a 45ms, probablemente no valga la pena el esfuerzo. Enfocate en los que tardan segundos.
- **Sin un baseline** — Si no sabés cuánto tardaba antes, no podés saber si mejoraste. Medí antes de tocar nada.

## La regla que me salvó cien veces

Antes de optimizar cualquier cosa, respondé estas tres preguntas:

1. **¿Dónde está el cuello de botella?** (Datos, no intuición.)
2. **¿Cuánto impacto tiene?** (Si es el 2% del tiempo total, no importa.)
3. **¿Cuál es el costo de optimizarlo?** (A veces la solución es más cara que el problema.)

La optimización no es una actividad creativa. Es una actividad científica. Hipótesis, medición, conclusión.

## Esto es el Día 7

Este artículo es parte de **#100ArchitectureDays** — una serie de problemas reales de arquitectura con soluciones reales. La próxima vez que alguien diga "seguro es la base de datos", pedile los números.

Seguí la saga completa en **#100ArchitectureDays**.

Todo el código está en [GitHub](https://github.com/alafourcadev/100-architecture-days). Si te está sirviendo, dejame una estrella — es gratis y ayuda a que más gente lo encuentre.
