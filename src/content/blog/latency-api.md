---
title: "Día 12: Tu API responde 200 OK. El usuario piensa que está caída."
description: "Tu API no falla, pero tarda 500ms en responder. Para el usuario, es como si estuviera rota. Día 12 de #100ArchitectureDays."
tags: ["Java", "Spring Boot", "Architecture", "100ArchitectureDays"]
date: 2026-04-14
readTime: "8 min read"
image: "/blog/latency-api.webp"
day: 12
---

Tu API devuelve 200 OK. Todas las veces. Cero errores. Los tests pasan. El PM pregunta "¿por qué la app se siente lenta?" y tú respondes "el backend está bien, debe ser el frontend".

Spoiler: no es el frontend.

## Medio segundo no suena a mucho. Lo es.

500 milisegundos. Medio segundo. ¿Qué tanto puede ser?

Mucho. El usuario hace click, espera medio segundo, no pasa nada visible, hace click de nuevo, se generan dos requests, la UI se traba, el loading spinner aparece y desaparece. Percepción del usuario: "esta app anda mal".

Y esto no es un problema de Java o de Spring. Es un problema de **cualquier API** en cualquier lenguaje. Si tu endpoint en Django, Express, Gin o ASP.NET tarda 500ms, el usuario siente exactamente la misma frustración.

## ¿Dónde se van los 500ms?

El problema de la latencia es que se acumula silenciosamente. Tu endpoint no tiene una operación que tarda 500ms — tiene cinco operaciones que tardan 100ms cada una:

```
Request entra                              → 0ms
├── Deserialización del JSON               → 5ms
├── Validación                             → 2ms
├── Query a la base de datos               → 85ms
├── Llamada a servicio de autenticación    → 180ms
├── Llamada a servicio de precios          → 150ms
├── Serialización de respuesta             → 8ms
├── Compresión                             → 0ms (no configurada)
└── Overhead de red y framework            → 70ms
                                    Total  → 500ms
```

Ninguna línea individual es escandalosa. Pero sumadas, tienes medio segundo. Y eso es en el **mejor caso** — sin considerar el garbage collector, contención de threads, o un pico de tráfico.

## El concepto clave: paralelismo de I/O

La pregunta que cambia todo es: **¿estas operaciones dependen entre sí?**

Si la operación B necesita el resultado de la operación A, tienen que ser secuenciales. Pero si B y C son independientes, ¿por qué C espera a que B termine?

Este concepto existe en todos los lenguajes:

- **Java**: `CompletableFuture.supplyAsync()`
- **JavaScript/Node**: `Promise.all()`
- **Python**: `asyncio.gather()`
- **Go**: goroutines + channels o `errgroup`
- **C#/.NET**: `Task.WhenAll()`
- **Kotlin**: `coroutineScope { async {} }`

La sintaxis cambia. La idea es la misma: **si dos operaciones de I/O no dependen entre sí, ejecútalas al mismo tiempo**.

## El ANTES: todo secuencial

```java
@GetMapping("/producto/{id}")
public ProductoResponse obtenerProducto(@PathVariable Long id) {
    // 85ms
    Producto producto = productoRepository.findById(id).orElseThrow();

    // 180ms — espera a que termine para seguir
    Usuario usuario = authService.obtenerUsuario(producto.getVendedorId());

    // 150ms — espera a que termine para seguir
    BigDecimal precio = precioService.obtenerPrecioActual(id);

    // 120ms — espera a que termine para seguir
    Reviews reviews = reviewService.obtenerReviews(id);

    return new ProductoResponse(producto, usuario, precio, reviews);
}
```

Total: 85 + 180 + 150 + 120 = **535ms** solo en I/O. Todo secuencial. Cada operación espera a que la anterior termine, aunque **no dependen entre sí**.

El paso 1 (buscar producto) sí necesita ir primero porque los otros necesitan el `vendedorId`. Pero los pasos 2, 3 y 4 son completamente independientes. No hay razón para que esperen uno al otro.

## El DESPUÉS: paralelismo donde tiene sentido

```java
@GetMapping("/producto/{id}")
public ProductoResponse obtenerProducto(@PathVariable Long id) {
    // Paso 1: esto sí va primero (los demás dependen del resultado)
    Producto producto = productoRepository.findById(id).orElseThrow();

    // Pasos 2, 3 y 4: independientes → en paralelo
    CompletableFuture<Usuario> usuarioFuture = CompletableFuture.supplyAsync(
        () -> authService.obtenerUsuario(producto.getVendedorId())
    );
    CompletableFuture<BigDecimal> precioFuture = CompletableFuture.supplyAsync(
        () -> precioService.obtenerPrecioActual(id)
    );
    CompletableFuture<Reviews> reviewsFuture = CompletableFuture.supplyAsync(
        () -> reviewService.obtenerReviews(id)
    );

    // Esperar a los 3 — toma lo que tarde el más lento
    Usuario usuario = usuarioFuture.join();     // 180ms
    BigDecimal precio = precioFuture.join();     // 150ms (en paralelo)
    Reviews reviews = reviewsFuture.join();      // 120ms (en paralelo)
    // Tiempo real: max(180, 150, 120) = 180ms

    return new ProductoResponse(producto, usuario, precio, reviews);
}
```

Total: 85 + 180 = **265ms**. Bajamos 270ms sin cambiar lógica, sin cache, sin magia. Solo dejando de esperar innecesariamente.

En Node sería:

```javascript
const producto = await db.findById(id);
const [usuario, precio, reviews] = await Promise.all([
    authService.getUser(producto.vendedorId),
    precioService.getPrice(id),
    reviewService.getReviews(id)
]);
```

En Python:

```python
producto = await db.find_by_id(id)
usuario, precio, reviews = await asyncio.gather(
    auth_service.get_user(producto.vendedor_id),
    precio_service.get_price(id),
    review_service.get_reviews(id)
)
```

Mismo patrón. Mismo resultado.

## Gzip: la fruta más baja de todas

¿Tu API devuelve JSON sin comprimir? Eso es ancho de banda que estás regalando.

```yaml
server:
  compression:
    enabled: true
    mime-types: application/json,application/xml,text/html
    min-response-size: 1024
```

Un JSON de 50KB se convierte en ~8KB con Gzip. Tres líneas de configuración. Efecto inmediato, especialmente en mobile o con conexiones lentas.

En Express es `compression()` middleware. En Django es `GZipMiddleware`. En Go es `gzip.NewWriter()`. Tres líneas en cualquier lenguaje.

## Los números

| | ANTES | DESPUÉS | Mejora |
|---|---|---|---|
| Latencia p50 | 535ms | 265ms | **50%** |
| Latencia p95 | 1200ms | 450ms | **62%** |
| Tamaño respuesta | 48KB | 8KB (gzip) | **83%** |

## ¿Cuánto es "aceptable"?

No hay un número mágico, pero hay referencias basadas en la percepción del usuario:

- **< 100ms** — Se siente instantáneo. El usuario no percibe espera.
- **100-300ms** — Se siente rápido. Aceptable para la mayoría de las operaciones.
- **300-1000ms** — Se siente lento. El usuario nota la espera. Necesitas un loading indicator.
- **> 1000ms** — Se siente roto. El usuario piensa que algo falló.

Si tu API está en el rango de 300-500ms, no está "bien". Está en la zona donde el usuario empieza a frustrarse. Y la frustración no genera tickets de soporte — genera **abandono silencioso**.

## 5 quick wins para bajar latencia hoy

1. **Activa Gzip.** Tres líneas de configuración. Efecto inmediato en mobile.
2. **Paraleliza llamadas independientes.** CompletableFuture, Promise.all, asyncio.gather — el que aplique a tu lenguaje.
3. **Revisa tus queries.** Un EXPLAIN rápido te muestra si hay un full table scan escondido (Día 3 de la saga).
4. **Connection pooling.** Si cada request abre una conexión nueva a la DB, estás tirando 50-100ms en el handshake (Día 9 de la saga).
5. **Evita serializar lo que no necesitas.** Si tu entidad tiene 30 campos y el frontend usa 5, manda solo esos 5 (Día 2 de la saga).

## El error de fondo

La latencia es la métrica más importante que nadie mide. Medimos uptime (99.9%, orgullosos), medimos errores (0.1%, genial), medimos throughput (500 rps, fantástico). Pero nadie mide cuánto tarda cada request en llegar al usuario.

Tu API puede tener cero errores y seguir siendo una mala experiencia. **"Funciona" no es lo mismo que "funciona bien".**

## Esto es el Día 12

Este artículo es parte de **#100ArchitectureDays** — una serie de problemas reales de arquitectura con soluciones reales. Abre tu herramienta de monitoreo y mira el p95 de tus endpoints principales. Si supera los 300ms, tienes trabajo.

Sigue la saga completa en **#100ArchitectureDays**.

Todo el código está en [GitHub](https://github.com/alafourcadev/100-architecture-days) — con el BEFORE secuencial (~535ms) y el AFTER paralelo (~265ms) para que lo corras y veas la diferencia en tiempo real. Si te está sirviendo, déjame una estrella — es gratis y ayuda a que más gente lo encuentre.
