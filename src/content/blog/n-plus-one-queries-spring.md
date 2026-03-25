---
title: "N+1 Queries: el bug que tu DBA ya sabe que tenés"
description: "Para mostrar 50 usuarios hacés 250 queries a la base de datos. Tu DBA te odia y tiene razón. Día 005 de #100ArchitectureDays."
tags: ["Java", "Spring Boot", "Architecture", "100ArchitectureDays"]
date: 2026-04-05
readTime: "7 min read"
image: "/blog/n-plus-one-queries-spring.webp"
---

Para mostrar 50 usuarios tu app hace 251 queries a la base de datos. Y vos ni te enteraste.

No falla. No tira excepción. No aparece en ningún log por default. Simplemente tu página tarda 4 segundos en cargar y nadie sabe por qué. Bueno, tu DBA sí sabe. Y te odia.

## El supermercado

Imaginá que necesitás comprar 50 cosas. Vas al supermercado, comprás la primera, volvés a tu casa. Vas de nuevo, comprás la segunda, volvés. Y así 50 veces.

Ridículo, ¿no? Nadie haría eso en la vida real.

Bueno, tu ORM lo hace. Cada vez que accedés a una relación lazy, dispara un SELECT nuevo. Un viaje más a la base de datos. Uno por cada entidad. Y vos mirando el endpoint pensando "no sé por qué anda lento".

Esto se llama el **problema N+1** y es, sin exagerar, el bug de performance más común en cualquier aplicación que use un ORM. No importa si es Hibernate, Django, ActiveRecord, Entity Framework o Prisma. **Todos los ORMs tienen este problema.** Si tu framework carga relaciones de forma lazy por default, estás expuesto.

## El ANTES: lazy loading te arruina el día

Tenés un `Usuario` con una lista de `Pedido`. Clásico:

```java
@Entity
public class Usuario {
    @Id
    @GeneratedValue
    private Long id;
    private String nombre;

    @OneToMany(mappedBy = "usuario")
    private List<Pedido> pedidos; // LAZY por default
}
```

Y en tu servicio hacés algo inocente:

```java
List<Usuario> usuarios = usuarioRepository.findAll();

for (Usuario u : usuarios) {
    System.out.println(u.getNombre() + ": " + u.getPedidos().size());
}
```

Activá `spring.jpa.show-sql=true` y mirá el horror:

```sql
-- Query 1: traer todos los usuarios
SELECT * FROM usuario;

-- Query 2: pedidos del usuario 1
SELECT * FROM pedido WHERE usuario_id = 1;
-- Query 3: pedidos del usuario 2
SELECT * FROM pedido WHERE usuario_id = 2;
-- Query 4: pedidos del usuario 3
SELECT * FROM pedido WHERE usuario_id = 3;
-- ...
-- Query 51: pedidos del usuario 50
SELECT * FROM pedido WHERE usuario_id = 50;
```

**1 query para los usuarios + 50 queries para los pedidos = 51 queries.** Si cada usuario tiene 5 pedidos y cada pedido tiene ítems... ya estás en las 251 queries del título. Y eso para **una sola request HTTP**.

Multiplicá por 100 usuarios concurrentes y entendés por qué tu base de datos está llorando.

## El DESPUÉS: un solo viaje al supermercado

La solución es decirle a Hibernate: "traeme todo de una, no seas vago".

**Opción 1: JOIN FETCH en JPQL**

```java
@Query("SELECT u FROM Usuario u JOIN FETCH u.pedidos")
List<Usuario> findAllConPedidos();
```

**Opción 2: @EntityGraph (más declarativo)**

```java
@EntityGraph(attributePaths = {"pedidos"})
@Query("SELECT u FROM Usuario u")
List<Usuario> findAllConPedidos();
```

Resultado en la base de datos:

```sql
-- UNA sola query
SELECT u.*, p.*
FROM usuario u
LEFT JOIN pedido p ON u.id = p.usuario_id;
```

**251 queries se convierten en 1.** Un solo viaje. Todo lo que necesitás, de una sola vez.

## Los números

| | ANTES | DESPUÉS | Mejora |
|---|---|---|---|
| Queries | 251 | 1 | **99.6%** |
| Tiempo | ~4200ms | ~85ms | **98%** |

No es una mejora marginal. Es la diferencia entre una app que funciona y una que da vergüenza.

## Cómo detectar N+1 antes de producción

No esperés a que tu DBA te mande un mensaje pasivo-agresivo. Detectalo vos:

**1. Activá el logging de SQL en desarrollo:**

```yaml
spring:
  jpa:
    show-sql: true
    properties:
      hibernate:
        format_sql: true
```

Si ves el mismo SELECT repitiéndose con diferentes parámetros, tenés un N+1.

**2. Usá las estadísticas de Hibernate:**

```yaml
spring:
  jpa:
    properties:
      hibernate:
        generate_statistics: true
```

En el log vas a ver algo como:

```
Session Metrics {
    1234567 nanoseconds spent executing 251 JDBC statements
}
```

251 statements para un endpoint que debería hacer 1 o 2 queries. Ahí lo tenés. Evidencia irrefutable.

**3. Regla de oro:** si un endpoint ejecuta más de 10 queries, algo está mal. No hay excusa.

## Cuándo NO usar JOIN FETCH

Antes de que salgas a ponerle JOIN FETCH a todo (sí, te vi), hay un caso donde te va a explotar en la cara:

```java
// NUNCA hagas esto
@Query("SELECT u FROM Usuario u JOIN FETCH u.pedidos JOIN FETCH u.direcciones")
List<Usuario> findAllCompleto();
```

Si un usuario tiene 5 pedidos y 3 direcciones, Hibernate genera un **producto cartesiano**: 5 x 3 = 15 filas por usuario. Con 50 usuarios son 750 filas. Y la JVM tiene que deduplicar todo eso en memoria.

La regla: **JOIN FETCH con una sola colección a la vez.** Si necesitás múltiples colecciones, usá `@BatchSize` o queries separadas:

```java
@Entity
public class Usuario {
    @OneToMany(mappedBy = "usuario")
    @BatchSize(size = 50) // Carga en lotes de 50 en vez de 1 por 1
    private List<Pedido> pedidos;

    @OneToMany(mappedBy = "usuario")
    @BatchSize(size = 50)
    private List<Direccion> direcciones;
}
```

`@BatchSize` convierte 50 queries individuales en 1 query con un `IN` clause. No es tan eficiente como JOIN FETCH, pero evita el producto cartesiano.

## Esto no es solo Java

Si usás Django y hacés `User.objects.all()` y después accedés a `user.orders` en un loop, tenés el mismo problema. La solución allá es `select_related` y `prefetch_related`.

Si usás Rails, es `includes(:orders)`.

Si usás Entity Framework, es `.Include(u => u.Orders)`.

Si usás Prisma, es el `include: { orders: true }`.

**El patrón es universal.** Cambia la sintaxis, el problema es idéntico. Si tu ORM carga relaciones de forma lazy y vos iterás sin pensar, estás haciendo N+1. No importa el lenguaje, no importa el framework.

## Esto es el Día 005

Este artículo es parte de **#100ArchitectureDays** — una serie de problemas reales de arquitectura con soluciones reales. No teoría abstracta. Código que podés correr y medir.

La próxima vez que un endpoint ande lento, antes de escalar horizontalmente, antes de agregar un cache, antes de culpar a la base de datos... activá `show-sql` y contá las queries.

Te sorprendería la cantidad de problemas de performance que se resuelven con un JOIN FETCH bien puesto.

Seguí la saga completa en **#100ArchitectureDays**.
