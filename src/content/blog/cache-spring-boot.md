---
title: "Día 6: Tu caché no funciona y es tu culpa"
description: "Pusiste @Cacheable en todo y la app sigue lenta. El problema no es el caché — es lo que estás cacheando. Día 6 de #100ArchitectureDays."
tags: ["Java", "Spring Boot", "Architecture", "100ArchitectureDays"]
date: 2026-04-06
readTime: "7 min read"
image: "/blog/cache-spring-boot.webp"
day: 6
---

Pusiste `@Cacheable` en cada método del servicio. La app sigue lenta. Bienvenido al club.

## El error que todos cometemos

La primera vez que descubrís caché, es como descubrir el martillo. De repente todo parece un clavo. Endpoint lento? `@Cacheable`. Query pesada? `@Cacheable`. El servicio externo tarda? `@Cacheable`.

Y funciona. Al principio.

Después llegan los bugs. Silenciosos. Difíciles de reproducir. El tipo de bugs que te hacen cuestionar tu carrera.

## El desastre en acción

Mirá este servicio de e-commerce:

```java
@Service
public class ProductoService {

    @Cacheable("productos")
    public Producto obtenerProducto(Long id) {
        return productoRepository.findById(id).orElseThrow();
    }

    @Cacheable("precios")
    public BigDecimal obtenerPrecio(Long productoId) {
        return precioRepository.findPrecioActual(productoId);
    }

    @Cacheable("stock")
    public int obtenerStock(Long productoId) {
        return inventarioClient.consultarStock(productoId);
    }
}
```

Parece prolijo, ¿no? Cacheable en todo. Performance al máximo.

Ahora imaginá esto: un usuario ve un producto a $50.000. Lo agrega al carrito. Mientras tanto, el precio sube a $55.000. El usuario compra. ¿Qué precio le cobrás? El de la base de datos: $55.000. Pero él vio $50.000.

**Felicitaciones. Acabás de generar un reclamo, una devolución, y posiblemente un problema legal.**

¿Y el stock? Cacheaste que hay 3 unidades. Pero se vendieron todas hace 2 minutos. Ahora vendiste algo que no tenés.

El caché no falló. **Vos cacheaste lo que no debías.**

## Las reglas del caché que nadie te enseña

El caché funciona cuando se dan **dos condiciones juntas**:

1. **El dato cambia pocas veces** — Categorías de producto, configuraciones del sistema, catálogos, roles de usuario.
2. **El dato se lee muchas veces** — Endpoints que reciben cientos o miles de requests por minuto.

Si falta una de las dos, el caché no te sirve. O peor: te perjudica.

Los precios cambian. El stock cambia. Los datos de sesión cambian. **Eso no se cachea.** O si se cachea, se hace con una estrategia muy deliberada y un TTL agresivamente corto.

## La versión que sí funciona

```java
@Service
public class ProductoService {

    // Categorías: cambian una vez por semana. Se leen miles de veces por día.
    @Cacheable(value = "categorias", key = "#categoriaId")
    public Categoria obtenerCategoria(Long categoriaId) {
        return categoriaRepository.findById(categoriaId).orElseThrow();
    }

    // Configuración del sistema: cambia cuando alguien la modifica manualmente.
    @Cacheable("configuracion")
    public ConfiguracionTienda obtenerConfiguracion() {
        return configuracionRepository.findActiva();
    }

    // Precio: NUNCA cacheado. Siempre fresco.
    public BigDecimal obtenerPrecio(Long productoId) {
        return precioRepository.findPrecioActual(productoId);
    }

    // Stock: NUNCA cacheado. Siempre en tiempo real.
    public int obtenerStock(Long productoId) {
        return inventarioClient.consultarStock(productoId);
    }
}
```

Y cuando alguien modifica una categoría:

```java
@CacheEvict(value = "categorias", key = "#categoriaId")
public void actualizarCategoria(Long categoriaId, CategoriaRequest request) {
    // Actualizar en base de datos
    // El caché se invalida automáticamente
}
```

¿Ves la diferencia? No cacheamos todo. Cacheamos **lo correcto**.

## Las 4 preguntas antes de cachear

Antes de poner `@Cacheable` en cualquier cosa, hacete estas preguntas:

**1. ¿Con qué frecuencia cambia este dato?**
Si cambia cada minuto, no lo cachees. Si cambia una vez por día, es candidato.

**2. ¿Con qué frecuencia se lee?**
Si se lee 10 veces por hora, no vale la pena. Si se lee 10.000 veces por minuto, es candidato perfecto.

**3. ¿Qué pasa si el dato está desactualizado?**
Configuración de colores del sitio desactualizada 5 minutos? Nadie se muere. Precio desactualizado 5 minutos? Alguien pierde plata.

**4. ¿Cómo lo invalido?**
Si no tenés una estrategia clara de invalidación, **no lo cachees**. Un caché sin invalidación es una bomba de tiempo.

## Qué cachear vs qué NO

| Dato | Cambia | Se lee | ¿Cachear? |
|------|--------|--------|-----------|
| Categorías | 1x/mes | 1000x/día | ✅ SÍ |
| Configuraciones | 1x/semana | 500x/día | ✅ SÍ |
| Precios | cada minuto | 100x/día | ❌ NO |
| Stock | cada compra | 50x/día | ❌ NO |
| Sesión usuario | cada request | 1x | ❌ NO |

## Cuándo NO cachear

Esto aplica a cualquier caché. Redis, Memcached, CDN, browser cache, lo que sea:

- **Datos financieros en tiempo real** — Precios, saldos, tasas de cambio. El costo de un dato stale es demasiado alto.
- **Stock e inventario** — Vender algo que no tenés es peor que una query lenta.
- **Datos de sesión o autenticación** — Un usuario ve los datos de otro. Pesadilla de seguridad.
- **Resultados que dependen del momento** — Rankings en vivo, dashboards real-time, contadores de stock.
- **Datos que cambian con cada request** — Si cada llamada devuelve algo distinto, cachear no tiene sentido.

La regla es simple: **si el costo de servir un dato viejo es mayor que el costo de una query lenta, no cachees.**

## El TTL no es opcional

Si vas a cachear, definí un TTL. Siempre. Un caché sin TTL es un dato que nunca se refresca hasta que reiniciés la aplicación o la memoria explote.

```java
@Cacheable(value = "categorias", key = "#id")
// + configuración de TTL en tu cache manager:
// categorias -> TTL: 1 hora
// configuracion -> TTL: 30 minutos
```

El TTL es tu red de seguridad. Incluso si tu invalidación falla, el dato se refresca eventualmente.

## El caché es una decisión de arquitectura

El caché no es un decorator que tirás encima del código para que ande más rápido. Es una **decisión de arquitectura** que implica tradeoffs reales:

- Consistencia vs. performance
- Memoria vs. latencia
- Complejidad vs. velocidad

Cada `@Cacheable` que ponés es un contrato que dice: "acepto que este dato puede estar desactualizado por X tiempo, y las consecuencias son aceptables."

Si no podés articular ese contrato, no cachees.

## Esto es el Día 6

Este artículo es parte de **#100ArchitectureDays** — una serie de problemas reales de arquitectura con soluciones reales. No teoría abstracta. Código que podés correr y medir.

La próxima vez que estés por poner `@Cacheable` en un método, pará 30 segundos y hacete las 4 preguntas. Te van a ahorrar semanas de debugging de bugs fantasma que nadie puede reproducir.

Seguí la saga completa en **#100ArchitectureDays**.

Todo el código está en [GitHub](https://github.com/alafourcadev/100-architecture-days). Si te está sirviendo, dejame una estrella — es gratis y ayuda a que más gente lo encuentre.
