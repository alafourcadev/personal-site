---
title: "Día 4: Tu endpoint devuelve TODO. El frontend explota. La red llora."
description: "Offset vs cursor pagination: cuándo usar cada una y por qué tu app necesita esto ya. Día 4 de #100ArchitectureDays."
tags: ["Java", "Spring Boot", "Architecture", "100ArchitectureDays"]
date: 2026-03-31
readTime: "7 min read"
image: "/blog/paginacion-spring.webp"
day: 4
---

Tu endpoint de productos funciona perfecto en desarrollo. 100 registros, respuesta instantánea. Pero en producción tenés 50,000 productos y cada request a `/api/products` carga los 50,000 en memoria, los serializa a JSON, y manda 10MB por la red.

El frontend hace un `JSON.parse()` de 10MB. El navegador se congela. El usuario cierra la pestaña. Y vos mirando los logs pensando "en mi máquina funciona".

## El problema real

No paginar no es un shortcut. Es una bomba de tiempo.

Con 50,000 registros sin paginar, tu endpoint:

- **Carga todo en memoria** — potencial `OutOfMemoryError`
- **Serializa todo a JSON** — CPU al 100%
- **Transmite todo por la red** — ~10MB por request
- **El cliente espera 30 segundos** — timeout y usuarios frustrados

Y lo peor: escala linealmente. Hoy son 50,000, mañana son 200,000. El problema solo crece.

## El ANTES: devolver todo

```java
@Service
@Profile("before")
public class NoPaginationService implements ProductService {

    @Override
    public Object getProducts(int page, int size, Long cursor) {
        return repository.findAll(); // Los 50,000. Todos. Sin piedad.
    }
}
```

```sql
SELECT * FROM products;  -- 50,000 registros. RIP memoria.
```

## El DESPUÉS: dos estrategias, cada una con su lugar

### Offset Pagination — la clásica

```java
@Service
@Profile("offset")
public class OffsetPaginationService implements ProductService {

    @Override
    public Object getProducts(int page, int size, Long cursor) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("id"));
        return repository.findAllProjectedBy(pageRequest);
    }
}
```

```sql
SELECT * FROM products ORDER BY id LIMIT 20 OFFSET 1000;
```

Spring Data JPA te da `Pageable` out of the box. Le pasás página y tamaño, y te devuelve un `Page<T>` con los datos, el total de páginas, el total de elementos, si hay siguiente... todo. Para una UI con paginitas numeradas, es perfecto.

**Pero tiene un problema.** Cuanto más alto el offset, más lenta la query. ¿Por qué? Porque PostgreSQL tiene que:

1. Leer **todos** los registros hasta el offset
2. Ordenarlos
3. **Descartar** los primeros N
4. Devolver solo los siguientes M

Página 1: lee 20 registros. Página 2000: lee 40,020 registros para devolver 20.

### Cursor Pagination — la escalable

```java
@Service
@Profile("after")
public class CursorPaginationService implements ProductService {

    @Override
    public Object getProducts(int page, int size, Long cursor) {
        List<Product> products;
        if (cursor == null || cursor == 0) {
            products = repository.findFirstPage(PageRequest.of(0, size + 1));
        } else {
            products = repository.findByCursorAfter(cursor, PageRequest.of(0, size + 1));
        }
        boolean hasNext = products.size() > size;
        // construir respuesta con nextCursor
    }
}
```

```sql
SELECT * FROM products WHERE id > 1000 ORDER BY id LIMIT 20;
```

En vez de decir "saltá 1000 y dame 20", le decís "dame los 20 que vienen después del ID 1000". PostgreSQL usa el índice, va directo al registro 1001, y lee 20. Siempre. No importa si estás en la página 1 o en la 2000.

## Los números

```
Página 1 (offset=0):
  Offset:  5ms    |  Cursor:  5ms

Página 100 (offset=2000):
  Offset:  15ms   |  Cursor:  5ms

Página 1000 (offset=20000):
  Offset:  150ms  |  Cursor:  5ms

Página 2500 (offset=50000):
  Offset:  400ms+ |  Cursor:  5ms
```

¿Ves el patrón? Offset se degrada. Cursor se mantiene constante. **O(n) vs O(1).**

Con 50,000 registros la diferencia es 400ms vs 5ms. Con 5 millones de registros, offset puede tardar segundos mientras cursor sigue en 5ms. Es una diferencia arquitectónica, no una micro-optimización.

## ¿Cuál uso?

No hay una respuesta universal. Depende de tu caso de uso:

| Escenario | Estrategia |
|---|---|
| Dashboard con tabla y paginitas numeradas | **Offset** — el usuario necesita saltar a la página 47 |
| Scroll infinito (feed, timeline) | **Cursor** — rendimiento constante en cada scroll |
| API pública | **Cursor** — no querés que un cliente pida página 999999 |
| Exportar datos en lotes | **Cursor** — procesás de a chunks sin degradar |
| Panel admin con pocos registros | **Offset** — la simplicidad gana, metadata completa |

La regla general: **si el usuario necesita saltar a una página específica, usá offset. Si siempre avanza secuencialmente, usá cursor.**

## La respuesta de cursor en la práctica

```java
public record CursorPage<T>(
    List<T> content,
    String nextCursor,
    String previousCursor,
    boolean hasNext,
    boolean hasPrevious,
    int size
) {}
```

El truco está en pedir `size + 1` registros. Si te vuelven 21 cuando pediste 20, sabés que hay más. Devolvés 20 y ponés `hasNext: true` con el cursor del último elemento. El cliente manda ese cursor en la siguiente request. Elegante y sin queries extra para contar totales.

## Cuándo NO paginar

Sí, hay casos donde paginar agrega complejidad innecesaria:

- **Datasets que siempre van a ser chicos.** Si tu tabla de categorías tiene 15 registros y nunca va a tener más de 50, un `findAll()` está bien. No sobre-ingenieres.
- **Búsquedas con filtros muy selectivos.** Si tu query siempre devuelve menos de 100 resultados porque los filtros son específicos, la paginación agrega overhead sin beneficio.
- **Datos que necesitás completos para calcular algo.** Si tenés que sumar todos los montos de un reporte, paginá en la base de datos y procesá en streaming, no pagines en la API.
- **Endpoints internos entre microservicios.** Si el consumidor siempre necesita todo y está en la misma red, la paginación agrega latencia por el ida y vuelta extra.

Pero si tu endpoint es público, si el dataset crece, si un usuario puede llegar con un browser: **paginá. Siempre.**

## Esto no es solo Java

Si usás Django, tenés `Paginator` para offset y podés implementar cursor con `django-cursor-pagination` o manualmente con filtros en el queryset.

Si usás Rails, `kaminari` y `will_paginate` hacen offset. Para cursor, filtrás con `.where("id > ?", cursor).limit(size)`.

Si usás Express con Prisma, es `skip/take` para offset y `cursor` como parámetro nativo de Prisma.

Si usás FastAPI con SQLAlchemy, es `.offset().limit()` vs `.filter(Model.id > cursor).limit()`.

**El patrón es el mismo en todos los lenguajes.** Offset usa `OFFSET` en SQL (o su equivalente) y se degrada linealmente. Cursor usa un `WHERE` con un valor de referencia y mantiene rendimiento constante. No importa el framework — la base de datos se comporta igual.

## Esto es el Día 4

Este artículo es parte de **#100ArchitectureDays** — una serie de problemas reales de arquitectura con soluciones reales. Código que podés correr, medir, y ver cómo se degrada offset mientras cursor se mantiene firme.

Si tu endpoint devuelve todo sin paginar, hoy es el día de arreglar eso. Tu base de datos, tu red, y tus usuarios te lo van a agradecer.

Seguí la saga completa en **#100ArchitectureDays**.

💻 Todo el código está en [GitHub](https://github.com/alafourcadev/100-architecture-days). Si te está sirviendo, dejame una ⭐ — es gratis y ayuda a que más gente lo encuentre.
