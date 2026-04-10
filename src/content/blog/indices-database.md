---
title: "Día 10: Le pusiste índices a todo y ahora los INSERT tardan 800ms"
description: "Los índices no son gratis. Cada uno acelera una lectura pero frena todas las escrituras. Las 4 reglas para indexar sin romper tu base. Día 10 de #100ArchitectureDays."
tags: ["Java", "Spring Boot", "Architecture", "100ArchitectureDays"]
date: 2026-04-10
readTime: "8 min read"
image: "/blog/indices-database.webp"
day: 10
---

Alguien en el equipo corrió un `EXPLAIN`, vio un full table scan, y la solución fue obvia: *"ponele un índice"*. Funcionó. La query pasó de 3 segundos a 40 milisegundos. Eureka.

Entonces le pusieron índice a la siguiente columna. Y a la siguiente. Y a la siguiente. Y ahora los INSERT tardan 800ms y nadie entiende por qué.

Bienvenido al anti-pattern más común en bases de datos: **indexar todo por si acaso**.

## Qué es un índice (y por qué cuesta)

Antes de hablar de código, el concepto. Porque esto no es de MySQL ni de PostgreSQL — es de **cualquier base de datos que hayas usado o vayas a usar**.

Un índice es una **estructura de datos adicional** que la base mantiene en paralelo a tu tabla. Generalmente es un B-tree (o un B+tree) que ordena los valores de una columna para que buscar uno específico sea logarítmico en vez de lineal.

Acelera las lecturas. Eso está claro.

Lo que nadie te cuenta es el otro lado: **cada índice hay que mantenerlo actualizado en cada escritura**. Cuando hacés un `INSERT`, la base no solo escribe la fila — actualiza **todos** los índices de esa tabla. Cada uno. Uno por uno.

Si tenés 12 índices, cada `INSERT` tiene que actualizar 12 estructuras de datos. Cada `UPDATE` que toque una columna indexada recalcula ese índice. Cada `DELETE` limpia la fila y limpia los índices asociados.

No es gratis. Nunca fue gratis.

Y esto aplica en:
- **PostgreSQL** (B-tree, GIN, GiST, BRIN)
- **MySQL / MariaDB** (B-tree, Hash, Full-text)
- **Oracle** (B-tree, Bitmap)
- **SQL Server** (Clustered, Non-clustered)
- **MongoDB** (B-tree, compound, text, geospatial)
- **DynamoDB** (local + global secondary indexes)

Cambia la sintaxis. Cambia el engine. El tradeoff es idéntico: **escrituras más caras a cambio de lecturas más baratas**.

## El ANTES: la tabla navideña

Mirá esta entidad. Decime si no te suena de algún proyecto:

```java
@Entity
@Table(name = "pedidos", indexes = {
    @Index(name = "idx_cliente",     columnList = "clienteId"),
    @Index(name = "idx_fecha",       columnList = "fecha"),
    @Index(name = "idx_estado",      columnList = "estado"),
    @Index(name = "idx_total",       columnList = "total"),
    @Index(name = "idx_moneda",      columnList = "moneda"),
    @Index(name = "idx_sucursal",    columnList = "sucursal"),
    @Index(name = "idx_vendedor",    columnList = "vendedorId"),
    @Index(name = "idx_canal",       columnList = "canal"),
    @Index(name = "idx_prioridad",   columnList = "prioridad"),
    @Index(name = "idx_tipo",        columnList = "tipo")
})
public class Pedido {
    @Id @GeneratedValue
    private Long id;
    private Long clienteId;
    private LocalDate fecha;
    private String estado;
    private BigDecimal total;
    private String moneda;
    private String sucursal;
    private Long vendedorId;
    private String canal;
    private String prioridad;
    private String tipo;
}
```

**Diez índices.** Para una tabla transaccional que recibe miles de INSERTs por hora. Cada escritura paga el costo de mantener diez B-trees actualizados. Todos. Para cada fila.

Alguien los puso en algún momento pensando "por si acaso alguien quiere buscar por canal". Nadie nunca buscó por canal. Pero el índice sigue ahí, encareciendo cada escritura, consumiendo disco, ralentizando los backups.

## El DESPUÉS: solo lo que importa

```java
@Entity
@Table(name = "pedidos", indexes = {
    @Index(name = "idx_cliente_fecha", columnList = "clienteId, fecha"),
    @Index(name = "idx_estado",        columnList = "estado")
})
public class Pedido {
    // mismos campos
}
```

**Dos índices.** Uno compuesto que cubre el 80% de las queries reales (buscar pedidos de un cliente en un rango de fechas) y otro para el filtro por estado que el dashboard usa todo el tiempo.

Nada más. El resto de las columnas no necesitan índice porque **nadie las filtra en producción**.

## Los números del benchmark

| | ANTES (10 índices) | DESPUÉS (2 índices) | Mejora |
|---|---|---|---|
| INSERT 5K registros | ~1240ms | ~380ms | **69%** |
| SELECT por cliente | ~5ms | ~5ms | Sin cambio |
| Espacio en disco | 2.1 GB | 380 MB | **82%** |

Los SELECTs **apenas cambiaron** porque los 8 índices que sacamos casi nunca se usaban. Estaban ahí consumiendo disco y frenando escrituras sin que nadie los necesitara.

El código de este benchmark está en el repo — podés correrlo y ver los números reales en tu máquina. Cambiar la cantidad de registros para ver cómo escala la diferencia.

## Las 4 reglas para decidir qué indexar

### Regla 1: Mirá las queries reales, no las que imaginás

El error más común es indexar *en teoría*. "Por si acaso alguien consulta por sucursal". Nadie va a consultar por sucursal. Pero el índice está ahí, encareciendo cada escritura para una query que no existe.

Mirá lo que tu app hace **de verdad**:

```sql
-- PostgreSQL: las queries más lentas
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- MySQL: queries que hacen full scan
SELECT * FROM sys.statements_with_full_table_scans
ORDER BY no_index_used_count DESC;

-- MongoDB: queries lentas
db.system.profile.find({millis: {$gt: 100}}).sort({ts: -1});
```

Si no hay una query real que use esa columna en un `WHERE`, `JOIN` o `ORDER BY`, **no necesitás el índice**. Punto.

### Regla 2: Los índices compuestos son tu mejor amigo

Un índice compuesto en `(clienteId, fecha)` cubre automáticamente:

- `WHERE clienteId = ?` → usa la primera columna
- `WHERE clienteId = ? AND fecha > ?` → usa ambas
- `ORDER BY clienteId, fecha` → usa ambas
- `WHERE clienteId = ? ORDER BY fecha` → usa ambas

Un índice por separado en `clienteId` y otro en `fecha` **no** dan el mismo resultado. El optimizador elige uno de los dos, no los combina mágicamente. Un índice compuesto bien pensado reemplaza 2 o 3 índices individuales.

### Regla 3: Las columnas de baja cardinalidad casi nunca justifican un índice solo

Un campo `estado` con 4 valores posibles (`PENDIENTE`, `PROCESADO`, `ENVIADO`, `CANCELADO`) filtra el 25% de la tabla por valor. En tablas grandes, eso sigue siendo un montón de filas. El optimizador a veces decide ignorar el índice y hacer un full scan porque es más rápido.

Lo mismo con booleanos. Un índice en una columna `activo` donde el 90% es `true` es inútil — la query va a tocar el 90% de las filas de todas formas.

Si insistís en indexar una columna de baja cardinalidad, combinála con otra columna más selectiva en un índice compuesto.

### Regla 4: La regla del 5%

Si una query devuelve más del **5% de las filas** de la tabla, el optimizador probablemente ignore el índice y haga un full scan. Porque leer un 5% de la tabla ordenada secuencialmente es más rápido que saltar de un lado a otro siguiendo un B-tree.

Los índices son para queries **selectivas**. Si tu filtro es "traeme el 80% de las filas", indexar no ayuda.

## La pregunta clave antes de crear un índice

Antes de crear un índice, preguntate: **¿esta tabla recibe más lecturas o más escrituras?**

- **Tabla de productos / catálogo**: miles de lecturas por segundo, pocas escrituras por día. Ponele los índices que quieras. Los reads valen mucho y los writes casi no duelen.

- **Tabla de eventos / logs / auditoría**: miles de escrituras por segundo, lecturas ocasionales para reportes. Cada índice duele mucho. Indexá lo mínimo indispensable.

- **Tabla de pedidos / transacciones**: escrituras Y lecturas frecuentes. Acá es donde tenés que ser quirúrgico. Indexá lo que las queries reales necesitan, nada más.

No hay una respuesta universal. Hay **tradeoffs**. Tu trabajo es entenderlos, no ignorarlos.

## El error de fondo

El problema nunca fue "faltan índices". El problema fue no preguntarse **cuáles**.

Poner un índice en cada columna es como poner un semáforo en cada esquina — en algún momento, el remedio es peor que la enfermedad.

Un índice es un **contrato**: "acepto pagar más en cada escritura para ganar velocidad en esta lectura específica". Si no sabés cuál es la lectura que estás optimizando, no firmes el contrato.

## Esto es el Día 10

Este artículo es parte de **#100ArchitectureDays** — una serie de problemas reales de arquitectura con soluciones reales. La próxima vez que alguien diga "ponele un índice", preguntale dos cosas: **¿a cuál columna?** y **¿por qué?**. Si no puede responder las dos, no hay que indexar nada todavía.

Seguí la saga completa en **#100ArchitectureDays**.

Todo el código está en [GitHub](https://github.com/alafourcadev/100-architecture-days) — con un benchmark que podés correr para ver en vivo cómo los índices de más frenan los INSERTs. Si te está sirviendo, dejame una estrella — es gratis y ayuda a que más gente lo encuentre.
