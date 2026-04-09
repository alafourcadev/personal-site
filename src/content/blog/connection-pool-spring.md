---
title: "Día 9: Tu app funcionó todo el QA. El lunes a las 9am explotó con 100 usuarios."
description: "Connection pools, leaks silenciosos y la matemática de por qué 9 conexiones pueden manejar miles de requests. Día 9 de #100ArchitectureDays."
tags: ["Java", "Spring Boot", "Architecture", "100ArchitectureDays"]
date: 2026-04-09
readTime: "8 min read"
image: "/blog/connection-pool-spring.webp"
day: 9
---

Viernes, 18:00. Deploy a producción. Todo anda perfecto con el equipo de testing. El lunes a las 9:00 entran 100 usuarios reales y la app escupe:

```
SQLTransientConnectionException: Connection is not available,
request timed out after 30000ms
```

El pool de conexiones se quedó sin stock. Y nadie configuró nada porque *"Spring Boot se encarga de eso"*.

Si esto te suena familiar, seguí leyendo.

## Qué es un connection pool (y por qué existe)

Antes de hablar de código, necesitamos entender de qué estamos hablando. Porque este problema no es de Spring ni de Java — es de cualquier aplicación que hable con una base de datos.

Abrir una conexión a una base de datos es **caro**. Cada conexión implica:

- Un **TCP handshake** (3 roundtrips de red)
- **Autenticación** (usuario, password, negociación SSL si aplica)
- **Negociación de protocolo** con el servidor
- **Alocación de recursos** en el lado del servidor

Todo junto puede tardar 50-100ms. Si tu endpoint abre y cierra una conexión por cada request, con 100 requests por segundo estás creando 100 conexiones nuevas por segundo. Eso mata a la base de datos.

La solución existe desde los 90s y es universal: un **connection pool**. Creás N conexiones al inicio, las dejás abiertas, y las reutilizás. Cuando tu código necesita una conexión, la pide prestada del pool. Cuando termina, la devuelve. Nadie abre ni cierra nada.

Cada lenguaje tiene su implementación:

- **Java**: HikariCP (el que usa Spring Boot por defecto), C3P0, Apache DBCP
- **Python**: SQLAlchemy Pool, psycopg2 pool, Django lo maneja internamente
- **Node.js**: pg-pool, mysql2 pool, Prisma tiene pool integrado
- **Go**: el `database/sql` del stdlib maneja el pool automáticamente
- **Ruby**: ActiveRecord tiene pool integrado
- **.NET**: el ADO.NET tiene pooling automático

La herramienta cambia. El concepto es idéntico: **no crear conexiones nuevas, reusar las que ya tenés**.

## El primer error: no configurarlo

La configuración por defecto de HikariCP en Spring Boot es:

```yaml
maximum-pool-size: 10     # Máximo 10 conexiones
connection-timeout: 30000 # 30 segundos esperando una conexión
```

10 conexiones. Para una app con 100 usuarios concurrentes donde cada request tarda 200ms en la query, eso significa que podés procesar 50 requests por segundo (10 conexiones / 0.2 seg). Suena bien.

Pero si un endpoint tiene una query que tarda 2 segundos — un reporte, una búsqueda compleja, una transacción larga — esas 10 conexiones sirven 5 requests por segundo. El resto espera. Y si más de 10 requests llegan al mismo tiempo, alguno va a esperar 30 segundos completos y explotar con timeout.

## El segundo error (el grave): connection leaks

Peor que tener pocas conexiones es **perder** conexiones. Un connection leak pasa cuando tu código pide una conexión del pool y nunca la devuelve.

```java
// NUNCA hagas esto
public List<Reporte> generar() {
    Connection conn = dataSource.getConnection();
    PreparedStatement stmt = conn.prepareStatement("SELECT ...");
    ResultSet rs = stmt.executeQuery();
    return mapear(rs);
    // Si hubo una excepción arriba, conn.close() nunca se llama
    // La conexión queda colgada. Para siempre.
}
```

Este patrón — en cualquier lenguaje — es una **bomba de tiempo**. Cada error deja una conexión huérfana. Después de 10 errores, tu pool está vacío. La app entera se cae, no solo este endpoint.

El síntoma clásico:

> "Funciona un rato y después se cuelga. Si reiniciamos el pod, vuelve a andar."

Reiniciar el pod limpia el pool. Pero el leak sigue ahí, esperando.

## La versión correcta

En Spring Boot, **nunca llames a `dataSource.getConnection()` directamente**. Usá `JdbcTemplate`:

```java
@Service
public class ReporteService {

    private final JdbcTemplate jdbcTemplate;

    public ReporteService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Reporte> generar() {
        return jdbcTemplate.query(
            "SELECT id, nombre, total FROM reportes WHERE fecha > ?",
            (rs, rowNum) -> new Reporte(
                rs.getLong("id"),
                rs.getString("nombre"),
                rs.getBigDecimal("total")
            ),
            LocalDate.now().minusDays(30)
        );
    }
}
```

`JdbcTemplate` maneja la conexión por vos. La pide, la usa, y la devuelve. **Siempre.** Incluso si hay una excepción. Si usás JPA/Hibernate, `@Transactional` hace lo mismo.

Este patrón se repite en todos los lenguajes:
- **Python**: usá `with connection.cursor()` (context manager)
- **Node.js**: usá `pool.query()`, nunca `pool.connect()` sin `.release()`
- **Go**: usá `db.Query()`, no `db.Conn()`
- **Ruby**: ActiveRecord maneja todo, no pelees contra él

La regla universal: **dejá que el framework maneje el ciclo de vida de la conexión**.

## Leak detection: tu seguro de vida

HikariCP tiene una funcionalidad que te salva de los leaks silenciosos:

```yaml
spring:
  datasource:
    hikari:
      leak-detection-threshold: 60000  # 60 segundos
```

Si una conexión lleva más de 60 segundos sin ser devuelta, HikariCP te lo dice en los logs con un stack trace completo de quién la pidió:

```
[WARN] HikariPool-1 - Connection leak detection triggered for
  on thread http-nio-8080-exec-7, stack trace follows:
    java.lang.Exception: Apparent connection leak detected
      at com.example.ReporteService.generar(ReporteService.java:23)
```

Archivo, línea, thread. No más adivinar. **Activalo siempre.** Es gratis y te va a salvar una noche de guardia.

## La matemática del pool size (el punto que nadie entiende)

Todos quieren saber: *"¿cuántas conexiones necesito?"* La intuición dice: **más es mejor**. La intuición está equivocada.

La fórmula del autor de HikariCP:

```
connections = ((core_count * 2) + effective_spindle_count)
```

Para un servidor de base de datos con 4 cores y un SSD:

```
conexiones = (4 * 2) + 1 = 9
```

Sí. **9 conexiones.** En un pool bien configurado, 9 conexiones pueden manejar **miles de requests por segundo**.

¿Por qué? Porque la base de datos solo puede hacer trabajo real en paralelo hasta cierto límite. Si tu servidor tiene 4 cores, más de 8-10 queries concurrentes empiezan a **pelearse por CPU**. Agregás más context switches, más locks, más contención. Más conexiones no te da más throughput — te da **menos**.

La clave no es tener muchas conexiones. Es **devolverlas rápido**.

## La configuración que recomiendo

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 10000       # 10 seg, no 30
      idle-timeout: 300000            # 5 min
      max-lifetime: 1200000           # 20 min
      leak-detection-threshold: 60000
      pool-name: mi-app-pool
```

¿Por qué estos valores?

- **20 conexiones**: suficiente para la mayoría de apps CRUD. Ajustá según tu caso.
- **minimum-idle 5**: no mantengas 20 conexiones abiertas a las 3am cuando no hay nadie.
- **connection-timeout 10s**: si en 10 segundos no hay conexión, algo está mal. Fallá rápido.
- **max-lifetime 20min**: las conexiones se renuevan para evitar firewalls que matan conexiones idle.
- **pool-name**: cuando tengas múltiples datasources, saber cuál es cuál vale oro.

## Métricas que tenés que mirar

Con Actuator + Micrometer tenés estas métricas en tiempo real:

```
hikaricp.connections.active    → Conexiones en uso ahora
hikaricp.connections.idle      → Conexiones disponibles
hikaricp.connections.pending   → Threads esperando conexión
hikaricp.connections.timeout   → Timeouts acumulados
```

Reglas simples para leer estas métricas:

- Si `pending > 0` de forma sostenida → **tu pool es chico**
- Si `timeout` crece → **tenés un problema serio** (leak o pool agotado)
- Si `active` está siempre al máximo → **estás al límite**
- Si `idle` nunca baja de `minimum-idle` → **todo bien**

## Cuándo NO tocar el pool size

- **Para "mejorar performance" sin datos** — Subir de 10 a 100 conexiones no hace tu app más rápida. Probablemente la haga más lenta.
- **Sin medir primero** — Si no sabés cuántas conexiones activas tenés en promedio, no sabés si necesitás más. Medí antes de tocar.
- **Cuando el problema es un leak** — Más conexiones solo te dan más tiempo antes de que explote. **Arreglá el leak.**
- **Sin coordinar con el DBA** — Si tu base soporta 100 conexiones y vos configurás 80 en cada instancia con 3 instancias, le estás pidiendo 240 conexiones a una base que soporta 100. Boom.

## Esto es el Día 9

Este artículo es parte de **#100ArchitectureDays** — una serie de problemas reales de arquitectura con soluciones reales. Si tu app dice "too many connections", el problema no es el límite. Es cuánto tardás en devolver cada una.

La próxima vez que alguien te diga "hay que subir el pool size", preguntale dos cosas: ¿cuántas conexiones activas hay en promedio? ¿cuánto tardan las queries? Si no puede responder las dos, no hay que subir nada. Hay que medir.

Seguí la saga completa en **#100ArchitectureDays**.

Todo el código está en [GitHub](https://github.com/alafourcadev/100-architecture-days) — con un demo del leak funcionando para que lo veas romper en vivo. Si te está sirviendo, dejame una estrella — es gratis y ayuda a que más gente lo encuentre.
