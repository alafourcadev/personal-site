---
title: "Día 8: Pusiste Redis y ahora tenés datos fantasma por todo el sistema"
description: "Cache-aside, write-through, write-behind: patrones de caché distribuido que necesitás conocer antes de meter Redis. Día 8 de #100ArchitectureDays."
tags: ["Java", "Spring Boot", "Architecture", "100ArchitectureDays"]
date: 2026-04-08
readTime: "8 min read"
image: "/blog/redis-cache-distribuido.webp"
day: 8
---

Pusiste Redis. La app vuela. El PM está feliz. Hasta que un usuario reporta que ve un precio que cambió hace 20 minutos. Otro dice que ve el stock de ayer. Y un tercero ve datos que ya no existen en la base.

Bienvenido a los **datos fantasma**. El caché distribuido te acaba de morder.

## Caché local vs caché distribuido: por qué es otro mundo

En el Día 6 hablamos de caché local — datos que viven en la memoria de tu aplicación. Cuando la app se reinicia, el caché desaparece. Limpio, simple, predecible.

El **caché distribuido** es un animal completamente distinto. El caché vive en un servidor externo (Redis, Memcached, Hazelcast) que **sobrevive** a tu aplicación. Reiniciás el servidor, deployas una nueva versión, y el caché sigue ahí con los datos de la versión anterior. Datos serializados con una clase que ya cambió. TTLs que nadie configuró. Keys que nadie limpia.

Es como dejar comida en la heladera de la oficina: eventualmente alguien va a encontrar algo irreconocible.

Este problema no es de Java ni de Redis. Si usás Django con Memcached, Node con Redis, Go con Redis, .NET con Redis — el mismo problema aplica. Los datos fantasma son un problema de **arquitectura**, no de implementación.

## Los 3 patrones que necesitás conocer

Antes de hablar de código, necesitás entender los tres patrones fundamentales de caché distribuido. Estos patrones existen en todos los lenguajes y frameworks:

### Cache-Aside (Lazy Loading)

La app consulta el caché. Si no está, va a la base de datos, guarda en el caché, y responde.

```
App → ¿Está en caché? → SÍ → Devolver
                        → NO → Consultar BD → Guardar en caché → Devolver
```

**Ventaja**: solo se cachean los datos que realmente se piden. Menos memoria.
**Desventaja**: el primer request siempre es lento (cache miss). Y hay una ventana entre la escritura y la invalidación donde los datos están stale.

### Write-Through

Cada vez que escribís en la base de datos, escribís también en el caché. Sincrónicamente.

```
App → Escribir en BD → Escribir en caché → Responder
```

**Ventaja**: el caché siempre está actualizado. Cero datos fantasma.
**Desventaja**: cada escritura es más lenta porque tiene que escribir en dos lugares. Y si el caché falla, ¿qué hacés? ¿Fallás la operación? ¿Seguís sin caché?

### Write-Behind (Write-Back)

Escribís en el caché primero y después, asincrónicamente, se escribe en la base de datos.

```
App → Escribir en caché (inmediato) → [Cola/Worker] → BD (asíncrono)
```

**Ventaja**: escrituras ultra rápidas. El usuario no espera a la base de datos.
**Desventaja**: si el caché se cae antes de que el dato llegue a la base, **perdiste el dato**. Este patrón requiere persistencia del caché y mucha confianza en tu infraestructura.

## El error clásico: caché sin estrategia

Ahora que conocés los patrones, mirá lo que hace la mayoría:

```java
@Service
public class ProductoService {

    @Cacheable("productos")
    public Producto obtener(Long id) {
        return productoRepository.findById(id).orElseThrow();
    }

    public void actualizar(Long id, ProductoRequest request) {
        productoRepository.save(/* ... */);
        // ¿Y el caché? Nadie lo invalidó.
    }
}
```

Actualizás un producto en la base de datos. Redis sigue sirviendo el viejo. El usuario ve datos de hace una hora. Nadie entiende por qué.

Esto es el equivalente a no tener ninguno de los 3 patrones. Es "tire los datos ahí y recemos".

## Cache-Aside implementado bien

El patrón más usado y más seguro. Acá va en Spring Boot con Redis, pero la lógica es la misma en cualquier stack:

```java
@Service
public class ProductoService {

    private final RedisTemplate<String, Producto> redisTemplate;
    private final ProductoRepository repository;

    public Producto obtener(Long id) {
        String key = "producto:" + id;

        // 1. Consultar Redis primero
        Producto cached = redisTemplate.opsForValue().get(key);
        if (cached != null) return cached;

        // 2. Cache miss — ir a la BD
        Producto producto = repository.findById(id).orElseThrow();

        // 3. Guardar en Redis con TTL
        redisTemplate.opsForValue().set(key, producto, Duration.ofMinutes(30));
        return producto;
    }

    public void actualizar(Long id, ProductoRequest request) {
        Producto producto = repository.findById(id).orElseThrow();
        producto.actualizar(request);
        repository.save(producto);

        // INVALIDAR el caché. No actualizar. INVALIDAR.
        redisTemplate.delete("producto:" + id);
    }
}
```

¿Ves la diferencia? En `actualizar()`, después de escribir en la BD, **borramos** la key de Redis. No la actualizamos — la borramos. El próximo `GET` va a ir a la BD, traer el dato fresco, y guardarlo de nuevo. Sin datos fantasma.

## La configuración que de verdad funciona

```java
@Configuration
@EnableCaching
public class RedisConfig {

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration
            .defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(10))
            .serializeValuesWith(
                SerializationPair.fromSerializer(
                    new GenericJackson2JsonRedisSerializer()
                )
            )
            .disableCachingNullValues();

        Map<String, RedisCacheConfiguration> configs = Map.of(
            "categorias", defaultConfig.entryTtl(Duration.ofHours(1)),
            "productos", defaultConfig.entryTtl(Duration.ofMinutes(5))
        );

        return RedisCacheManager.builder(factory)
            .cacheDefaults(defaultConfig)
            .withInitialCacheConfigurations(configs)
            .build();
    }
}
```

Tres cosas importantes:

1. **TTL por caché**: las categorías cambian cada muerte de obispo, una hora está bien. Los productos cambian más seguido, 5 minutos.
2. **Serialización JSON**: si usás la serialización Java por defecto, un cambio en la clase rompe todo el caché. Con JSON, al menos es legible y más tolerante a cambios.
3. **No cachear nulls**: si la base no tiene el dato, no guardes null en Redis. La próxima vez que lo pidan, va a responder null sin ir a la base, incluso si el dato ya existe.

## Invalidación: el problema más difícil de computación

Phil Karlton dijo que los dos problemas más difíciles en computación son la invalidación de caché y nombrar cosas. Tenía razón.

Con caché local, invalidar es fácil. Con Redis en un sistema distribuido, tenés N instancias de tu app. Todas leen del mismo Redis. Si una instancia actualiza un dato e invalida el caché, las demás se enteran porque Redis es centralizado. Bien.

El problema real es cuando tenés **múltiples escritores**:

```
Instancia A: lee producto X → Redis tiene X v1
Instancia B: actualiza X a v2 → Invalida Redis
Instancia A: actualiza X a v3 → Invalida Redis
Usuario pide X → Redis vacío → Va a la DB → ¿v2 o v3?
```

La respuesta depende del orden de las transacciones en la base de datos. Si no estás usando locks o versionado, podés terminar con una race condition que guarda v2 en Redis cuando v3 es la correcta.

## Cuándo NO usar Redis

- **Apps con una sola instancia** — Si tenés un solo servidor, un caché local (Caffeine en Java, django-cacheops en Python, node-cache en Node) es más rápido, más simple, y sin un componente extra que mantener.
- **Datos que cambian constantemente** — Si el TTL ideal es 2 segundos, básicamente no estás cacheando. Estás agregando complejidad gratis.
- **Cuando no sabés qué invalidar** — Si tu modelo de datos es tan complejo que no podés determinar qué cachés invalidar cuando algo cambia, Redis va a generar más bugs de los que resuelve.
- **Sin monitoreo** — Redis sin métricas es un punto ciego. Necesitás saber el hit rate, la memoria usada, las evictions. Si no los medís, no sabés si Redis está ayudando o solo ocupando RAM.

## La regla de oro

Redis no es un upgrade gratuito. Es un **componente de infraestructura** que necesita configuración, monitoreo, y una estrategia de invalidación clara. Si no tenés las tres cosas, un caché local probablemente te dé mejores resultados con una fracción de la complejidad.

La pregunta no es "¿necesito Redis?" La pregunta es "¿tengo más de una instancia de mi app y necesito que compartan caché?" Si la respuesta es no, cerrá este artículo y volvé a tu caché local.

## Esto es el Día 8

Este artículo es parte de **#100ArchitectureDays** — una serie de problemas reales de arquitectura con soluciones reales. Si tu Redis tiene un hit rate menor al 80%, tenés un problema de estrategia, no de infraestructura.

Seguí la saga completa en **#100ArchitectureDays**.

Todo el código está en [GitHub](https://github.com/alafourcadev/100-architecture-days). Si te está sirviendo, dejame una estrella — es gratis y ayuda a que más gente lo encuentre.
