---
title: "Día 3: Agregaste un índice y la consulta sigue lenta. El problema no era el índice."
description: "EXPLAIN ANALYZE es tu mejor amigo. Aprende a leer un query plan antes de optimizar a ciegas. Día 3 de #100ArchitectureDays."
tags: ["Java", "Spring Boot", "Architecture", "100ArchitectureDays"]
date: 2026-03-29
readTime: "7 min read"
image: "/blog/query-analysis-spring.webp"
day: 3
---

Agregaste un índice en la columna `status`. Te sentiste bien. Pusheaste a producción. La query sigue tardando 3 segundos.

El DBA te mira. Vos mirás el índice. El índice existe. Pero PostgreSQL lo ignora completamente. Como si no estuviera. Y vos sin entender por qué.

## El problema real

10,000 órdenes. Una query simple: buscar por estado y rango de fechas. Debería ser instantáneo. Pero no lo es.

El índice está ahí. Lo podés ver con `\di` en psql. Está creado, está sano, ocupa espacio en disco. Pero tu query hace **Seq Scan** — lee las 10,000 filas una por una como si el índice no existiera.

Spoiler: el índice no era el problema. Era **cómo lo usabas**.

## El ANTES: LOWER() te arruina el día

```java
@Query("SELECT o FROM Order o WHERE LOWER(o.status) = LOWER(:status) " +
       "AND o.createdAt BETWEEN :start AND :end")
List<Order> findByStatusIgnoreCaseAndDateRange(
    @Param("status") String status,
    @Param("start") LocalDateTime start,
    @Param("end") LocalDateTime end);
```

Se ve razonable, ¿no? "Por las dudas hago LOWER() para que sea case-insensitive." El problema es que ese `LOWER()` le dice a PostgreSQL: "olvidate del índice".

¿Por qué? Porque el índice está ordenado por el valor **original** de la columna: `PENDING`, `SHIPPED`, `DELIVERED`. Pero vos le estás pidiendo que busque por `LOWER(status)` — un valor **transformado**. PostgreSQL no puede usar un índice sobre `status` para buscar sobre `LOWER(status)`. Son cosas diferentes.

Entonces hace lo único que puede: leer **cada fila**, aplicarle `LOWER()`, y comparar. Fila por fila. Las 10,000. Eso es un Seq Scan.

## El DESPUÉS: normalizá antes, no durante

```java
@Service
@Profile("after")
public class OptimizedQueryService implements OrderService {

    @Override
    public List<Order> findOrdersByStatusAndDateRange(String status, ...) {
        String normalizedStatus = status.toLowerCase();
        return repository.findByStatusAndDateRangeOptimized(normalizedStatus, start, end);
    }
}
```

```java
@Query("SELECT o FROM Order o WHERE o.status = :status " +
       "AND o.createdAt BETWEEN :start AND :end")
List<Order> findByStatusAndDateRangeOptimized(
    @Param("status") String status,
    @Param("start") LocalDateTime start,
    @Param("end") LocalDateTime end);
```

La diferencia: normalizamos el dato **al insertarlo** (guardar siempre en minúsculas) y normalizamos el parámetro **antes de la query** (en Java, no en SQL). Así PostgreSQL compara columna vs valor directamente, y el índice funciona.

## EXPLAIN ANALYZE: tu mejor amigo

No adivinés. Preguntale a la base de datos qué está haciendo:

```sql
-- Query LENTA
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE LOWER(status) = 'pending'
AND created_at BETWEEN '2024-01-01' AND '2024-12-31';
```

```
Seq Scan on orders  (cost=0.00..285.00 rows=5000 width=64)
  Filter: ((lower(status) = 'pending') AND ...)
  Rows Removed by Filter: 5000
  Planning Time: 0.15 ms
  Execution Time: 45.23 ms
```

**Seq Scan.** Esa es la palabra que tenés que temer. Significa que PostgreSQL está leyendo toda la tabla.

Ahora la query optimizada:

```sql
-- Query RÁPIDA
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE status = 'pending'
AND created_at BETWEEN '2024-01-01' AND '2024-12-31';
```

```
Index Scan using idx_orders_status_created on orders
  Index Cond: ((status = 'pending') AND ...)
  Planning Time: 0.12 ms
  Execution Time: 0.05 ms
```

**Index Scan.** PostgreSQL fue directo a los datos que necesitaba.

## Los números

| | ANTES | DESPUÉS | Mejora |
|---|---|---|---|
| Tipo de Scan | Seq Scan | Index Scan | - |
| Tiempo | ~45ms | ~0.05ms | **900x** |
| Filas escaneadas | 10,000 | ~50 | **200x** |

Y eso con 10,000 registros. En producción con millones de filas, la diferencia entre Seq Scan e Index Scan es la diferencia entre un endpoint que responde y uno que hace timeout.

## Cómo leer un EXPLAIN ANALYZE (sin dormirte)

No necesitás un doctorado. Buscá estas tres cosas:

1. **Seq Scan** = malo. Significa que lee toda la tabla. Si ves esto en una tabla grande, tenés un problema.
2. **Index Scan** = bueno. Significa que usa el índice y va directo a los datos.
3. **Rows Removed by Filter** = desperdicio. Son filas que leyó pero descartó. Cuanto más alto el número, peor.

Si tu query tiene Seq Scan y Rows Removed by Filter alto, no necesitás más RAM ni más CPU. Necesitás revisar tu WHERE clause.

## Las funciones que matan tus índices

`LOWER()` no es la única culpable. Cualquier función aplicada a una columna en el WHERE invalida el índice:

- `UPPER(column)` — mismo problema que LOWER
- `TRIM(column)` — si necesitás trim, limpiá los datos al insertar
- `CAST(column AS ...)` — cuidado con conversiones implícitas
- `EXTRACT(YEAR FROM column)` — usá rangos de fechas en vez de extraer partes
- `column + 1 = 5` — reescribí como `column = 4`

La regla de oro: **la columna indexada debe aparecer sola en un lado de la comparación.** Si le envolvés una función, el índice no se puede usar.

## Cuándo NO optimizar la query

- **Tablas chicas.** Si tu tabla tiene 100 filas, un Seq Scan tarda microsegundos. PostgreSQL a veces elige Seq Scan a propósito porque es más rápido que buscar en el índice para tablas pequeñas.
- **Queries que corren una vez al día.** Un reporte nocturno que tarda 2 segundos no necesita un índice. No optimices lo que no duele.
- **Cuando el índice ralentiza las escrituras.** Cada índice que agregás hace que los INSERT y UPDATE sean más lentos. Si tu tabla tiene escritura intensiva, pensalo dos veces.
- **Cuando el selectividad es baja.** Si el 80% de tus órdenes son `PENDING`, el índice en `status` no ayuda mucho — PostgreSQL va a leer casi toda la tabla de todas formas y prefiere Seq Scan.

## Esto no es solo Java

Si usás Django con PostgreSQL y hacés `Order.objects.filter(status__iexact='pending')`, Django genera un `UPPER()` en la query. Mismo problema, misma solución: normalizá los datos.

Si usás Rails con `where("LOWER(status) = ?", status.downcase)`, estás invalidando el índice.

Si usás cualquier ORM con cualquier base de datos relacional, la regla es la misma: **las funciones en el WHERE matan los índices.** No importa si es PostgreSQL, MySQL, Oracle o SQL Server. El optimizador no puede usar un índice sobre una columna transformada.

`EXPLAIN ANALYZE` es la versión PostgreSQL. MySQL tiene `EXPLAIN`, SQL Server tiene `SET STATISTICS IO ON` y los execution plans gráficos. Cada motor tiene su herramienta. Aprendé a usarla antes de agregar índices a ciegas.

## Esto es el Día 3

Este artículo es parte de **#100ArchitectureDays** — una serie de problemas reales de arquitectura con soluciones reales. No teoría. Código que podés correr y medir.

La próxima vez que una query ande lenta, antes de agregar un índice, corré `EXPLAIN ANALYZE`. Puede que el índice ya exista y simplemente no lo estés usando. Diagnosticá primero, optimizá después.

Seguí la saga completa en **#100ArchitectureDays**.
