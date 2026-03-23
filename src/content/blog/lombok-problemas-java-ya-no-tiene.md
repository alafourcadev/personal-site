---
title: "Lombok fue creado para resolver problemas que Java ya no tiene"
description: "Y seguimos usándolo por costumbre, no por necesidad."
tags: ["Java", "Best Practices"]
date: 2025-12-18
readTime: "6 min read"
image: "/blog/lombok-problemas-java-ya-no-tiene.webp"
---

Aquí está la verdad incómoda: **Lombok fue creado para resolver problemas que Java ya no tiene.**

Y seguimos usándolo por costumbre, no por necesidad.

## La ilusión de @Data

`@Data` genera automáticamente getters, setters, `equals()`, `hashCode()` y `toString()`. Suena genial, ¿verdad? Hasta que lo usás en una entidad JPA.

```java
@Data
@Entity
public class Usuario {
    @Id
    @GeneratedValue
    private Long id;
    private String nombre;
    private String email;
}
```

El problema: `@Data` genera un `hashCode()` que incluye el `id`. Cuando persistís un objeto nuevo, el `id` es `null`. Después de guardarlo, el `id` cambia. Si ese objeto estaba en un `HashSet` o como key de un `HashMap`, **acabás de romper la colección** sin darte cuenta.

Esto no es un bug de Lombok. Es un bug tuyo por confiar ciegamente en una anotación que no entendés.

## @Slf4j: una línea que no vale la dependencia

```java
@Slf4j
public class MiServicio {
    // ...
}
```

Versus:

```java
public class MiServicio {
    private static final Logger log = LoggerFactory.getLogger(MiServicio.class);
}
```

Te ahorrás **una línea**. A cambio, agregás una dependencia externa, un annotation processor en tu build, y configuración adicional en tu IDE. ¿Vale la pena?

## @SneakyThrows: el peligro silencioso

Esta anotación esconde las checked exceptions. Parece conveniente, pero puede interferir con la lógica de `@Transactional` en Spring:

```java
@SneakyThrows
@Transactional
public void procesarPago(Pago pago) {
    // Si esto lanza una checked exception,
    // Spring NO hará rollback por defecto
    gateway.cobrar(pago);
}
```

Spring solo hace rollback automático con **unchecked exceptions** (RuntimeException). `@SneakyThrows` envuelve la checked exception sin que lo sepas, y tu transacción podría comitearse con datos corruptos.

**Corrupción silenciosa de datos.** Todo por ahorrarte un `throws` en la firma del método.

## @Builder sin validación

```java
@Builder
public class Pedido {
    private String producto;
    private int cantidad;
    private BigDecimal precio;
}

// Esto compila y ejecuta sin problemas:
Pedido pedido = Pedido.builder().build();
// producto = null, cantidad = 0, precio = null 💥
```

El builder de Lombok no valida nada. Podés crear objetos completamente inválidos sin que nadie te avise.

## La alternativa moderna: Records

Desde Java 16, tenemos Records:

```java
public record Usuario(Long id, String nombre, String email) {}
```

**Una línea.** Sin dependencias externas. Con garantías de inmutabilidad. Integrado nativamente en el lenguaje.

No necesitás Lombok para esto. Java ya lo resolvió.

## Los costos ocultos

- **Onboarding**: Cada nuevo developer tiene que entender qué hace Lombok por debajo.
- **Compatibilidad**: Lombok depende de APIs internas de Java que se rompen con cada versión mayor (Java 17, 21).
- **Annotation processors**: Conflictos con MapStruct, Dagger, y otros processors.
- **IDE dependency**: Sin el plugin de Lombok, tu código no compila en el IDE.

## Conclusión

Lombok no es malo. Fue increíblemente útil en su momento. Pero ese momento ya pasó.

Java evolucionó. Records, pattern matching, sealed classes — el lenguaje resolvió los problemas que Lombok intentaba parchar.

**Seguir usando Lombok en 2025 es como llevar paraguas en un día soleado.** No te hace daño, pero dice mucho de tus hábitos.

La próxima vez que pongas `@Data` en una clase, preguntate: *¿realmente lo necesito, o es pura costumbre?*
