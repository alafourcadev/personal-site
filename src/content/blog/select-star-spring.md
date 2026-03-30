---
title: "Día 2: El SELECT * que arruinó tu API (y vos ni te enteraste)"
description: "Tu API responde en 10 segundos porque estás trayendo columnas que nadie necesita. Día 2 de #100ArchitectureDays."
tags: ["Java", "Spring Boot", "Architecture", "100ArchitectureDays"]
date: 2026-03-27
readTime: "7 min read"
image: "/blog/select-star-spring.webp"
day: 2
---

50 usuarios. Un endpoint. 25 megabytes de JSON. El frontend solo necesitaba el nombre y el email.

Tu API tarda 10 segundos en responder y vos mirás New Relic pensando que es un problema de red. No es la red. Es que estás trayendo la foto de perfil de cada usuario codificada en base64 — 500KB por usuario — porque alguien escribió `SELECT *` y nadie lo cuestionó.

## El problema real

Abrí tu repositorio. Buscá los `findAll()`. Ahora fijate qué devuelve la entidad. Si tiene columnas tipo `BLOB`, `TEXT` con JSONs enormes, o cualquier campo que el frontend no usa... felicitaciones, estás haciendo **over-fetching**.

Over-fetching es traer más datos de los que necesitás. Suena inofensivo hasta que multiplicás 500KB de foto x 50 usuarios = 25MB que viajan por la red, se serializan a JSON, y se renderizan en un componente que solo muestra `nombre` y `email`.

No es un error de lógica. Es un error de pereza.

## El ANTES: traer todo porque "quizás lo necesito"

```java
@Entity
public class User {
    @Id
    @GeneratedValue
    private Long id;
    private String name;
    private String email;

    @Lob
    private byte[] profilePhoto; // 500KB promedio
    private String biography;     // texto largo
    private String preferences;   // JSON enorme
}
```

Y en tu servicio:

```java
@Service
@Profile("before")
public class SelectStarUserService implements UserService {

    @Override
    public List<?> findAllUsers() {
        return repository.findAll();  // SELECT * - trae TODO
    }
}
```

Hibernate genera:

```sql
SELECT id, name, email, profile_photo, biography, preferences
FROM users;
```

Resultado: **25 MB de payload** para mostrar una lista de nombres.

## El DESPUÉS: traer solo lo que necesitás

Definí una **Interface Projection** — una interfaz con solo los getters que te importan:

```java
public interface UserSummary {
    Long getId();
    String getEmail();
    String getName();
}
```

En tu repositorio:

```java
public interface UserRepository extends JpaRepository<User, Long> {
    List<UserSummary> findAllProjectedBy();
}
```

Y el servicio optimizado:

```java
@Service
@Profile("after")
public class ProjectionUserService implements UserService {

    @Override
    public List<?> findAllUsers() {
        return repository.findAllProjectedBy();  // Solo id, email, name
    }
}
```

Spring Data JPA detecta que `UserSummary` es una interfaz, genera un proxy y construye el SQL justo:

```sql
SELECT id, email, name FROM users;
```

Sin `@Query`. Sin SQL nativo. Sin magia oscura. Spring lo resuelve solo.

## Los números

| | ANTES | DESPUÉS | Mejora |
|---|---|---|---|
| Payload | ~25 MB | ~5 KB | **99.98%** |

Leíste bien. **99.98% de reducción en el tamaño del payload.** De 25 megabytes a 5 kilobytes. La diferencia entre un endpoint que tarda 10 segundos y uno que responde en milisegundos.

## ¿Por qué funciona?

El concepto se llama **Query Optimization** y tiene un primo hermano en el mundo de las APIs: el principio de **transferir solo lo necesario**.

```
ANTES:  SELECT * FROM users     → 25 MB payload → 10s de respuesta
DESPUÉS: SELECT id, email, name → 5 KB payload  → <100ms de respuesta
```

La base de datos lee menos columnas. El driver transfiere menos datos. Jackson serializa menos campos. La red transporta menos bytes. El frontend parsea menos JSON. **Todo el pipeline mejora** con un solo cambio.

Es como ir al supermercado y traerte el supermercado entero porque necesitabas leche. No tiene sentido, pero con los ORMs lo hacemos todos los días.

## Cuándo NO hacer esto

Antes de que salgas a crear proyecciones para cada endpoint, pará un segundo:

- **Endpoints de detalle.** Si el usuario pide `/users/42` y va a ver el perfil completo con foto, biografía y todo, necesitás la entidad completa. La proyección es para listados, no para vistas de detalle.
- **Consultas internas entre servicios.** Si tu service layer necesita la entidad completa para lógica de negocio, usar una proyección te va a forzar a hacer una segunda query. Es peor.
- **Entidades pequeñas.** Si tu entidad tiene 5 columnas y todas son strings cortos, la diferencia entre `SELECT *` y `SELECT id, name` es insignificante. No optimices lo que no necesita optimización.
- **Cuando necesitás el objeto para escribir.** Las proyecciones son read-only. Si vas a modificar la entidad y guardarla, necesitás la entidad real, no un proxy.

La regla: **si la diferencia de payload entre `SELECT *` y la proyección es menor al 50%, probablemente no vale la pena.** Pero si estás trayendo BLOBs, JSONs enormes, o columnas de texto libre en un listado... tenés un problema.

## Esto no es solo Java

Si usás Django y hacés `User.objects.all()`, estás trayendo todo. La solución es `.values('id', 'name', 'email')` o `.only('id', 'name', 'email')`.

Si usás Rails, es `User.select(:id, :name, :email)`.

Si usás Entity Framework, es `.Select(u => new { u.Id, u.Name, u.Email })`.

Si usás Prisma, es `select: { id: true, name: true, email: true }`.

**El patrón es universal.** Cada ORM tiene su forma de decir "traeme solo estas columnas". El problema no es el framework — es el default de traer todo porque es más fácil. `SELECT *` es cómodo hasta que tu API se arrastra.

## Esto es el Día 2

Este artículo es parte de **#100ArchitectureDays** — una serie de problemas reales de arquitectura con soluciones reales. Código que podés clonar, correr y medir vos mismo.

La próxima vez que escribas un endpoint de listado, preguntate: "¿realmente necesito todas estas columnas?" Si la respuesta es no, ya sabés qué hacer.

Seguí la saga completa en **#100ArchitectureDays**.

💻 Todo el código está en [GitHub](https://github.com/alafourcadev/100-architecture-days). Si te está sirviendo, dejame una ⭐ — es gratis y ayuda a que más gente lo encuentre.
