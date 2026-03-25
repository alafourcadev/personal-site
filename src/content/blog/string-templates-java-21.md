---
title: "String Templates en Java: la feature que Oracle mató antes de nacer"
description: "String Templates prometía ser la forma moderna de construir strings en Java 21. Pero Oracle la retiró en Java 23. Esta es la historia de la feature que no sobrevivió."
tags: ["Java"]
date: 2024-07-05
readTime: "5 min read"
image: "/blog/string-templates-java-21.webp"
---

> **⚠️ Actualización importante:** String Templates fue eliminado en Java 23 (JEP 465). Oracle retiró esta feature del lenguaje tras la etapa de preview. Este artículo documenta cómo funcionaba originalmente en Java 21, pero el código ya no es válido en versiones recientes de Java.

---

Esta es la historia de una feature que todos queríamos, que Java finalmente nos dio... y que Oracle decidió matar.

**String Templates** llegó en Java 21 como preview feature. Era elegante. Era útil. Resolvía un problema real. Y en Java 23, Oracle la retiró sin reemplazo. Así de simple.

¿Por qué escribo sobre una feature muerta? Porque lo que intentaba resolver sigue sin resolverse. Y porque la historia dice mucho sobre cómo evoluciona Java — y sobre por qué no deberías apostar tu código de producción en preview features.

## El dolor que intentaba resolver

Seamos honestos: construir strings en Java es y siempre fue un desastre. Tenemos tres formas, y las tres son malas:

### Concatenación con +

```java
String mensaje = "Hola " + nombre + ", tu pedido #" + pedidoId + " tiene " + items + " items.";
```

Funciona, pero es ilegible. Cuando tenés 4+ variables, querés tirarte por la ventana.

### String.format()

```java
String mensaje = String.format("Hola %s, tu pedido #%d tiene %d items.", nombre, pedidoId, items);
```

Mejor legibilidad, pero los `%s` y `%d` no te dicen qué variable va en cada posición. Es fácil equivocarte en el orden.

### StringBuilder

```java
String mensaje = new StringBuilder()
    .append("Hola ").append(nombre)
    .append(", tu pedido #").append(pedidoId)
    .append(" tiene ").append(items).append(" items.")
    .toString();
```

Verbose. Si te gusta escribir esto, tenemos que hablar.

## Lo que String Templates prometía

Con Java 21, podíamos escribir esto (preview feature):

```java
String mensaje = STR."Hola \{nombre}, tu pedido #\{pedidoId} tiene \{items} items.";
```

**Limpio. Legible. Seguro.**

Las variables van directamente donde las necesitás, encerradas en `\{ }`. No hay ambigüedad, no hay posiciones que confundir.

## ¿Cómo funciona?

String Templates usa **template processors**. `STR` es el procesador estándar que viene incluido:

```java
// Expresiones en los templates
String info = STR."El total es: \{precio * cantidad} USD";

// Llamadas a métodos
String saludo = STR."Hola \{nombre.toUpperCase()}, bienvenido!";

// Condicionales
String estado = STR."Pedido \{completado ? "listo" : "pendiente"}";
```

Podés meter cualquier expresión Java válida dentro de `\{ }`.

## Multi-line Templates

Una de las mejores partes — strings multi-línea con templates:

```java
String html = STR."""
    <html>
        <body>
            <h1>Hola \{nombre}</h1>
            <p>Tu balance es: \{balance} USD</p>
        </body>
    </html>
    """;
```

Combiná text blocks con templates y el resultado es código limpio y mantenible.

## Seguridad: el beneficio oculto

¿Por qué no usar simplemente concatenación? Porque String Templates puede **validar** lo que interpolás.

Imaginá un template processor para SQL:

```java
// Esto previene SQL injection automáticamente
PreparedStatement stmt = SQL."SELECT * FROM users WHERE name = \{userInput}";
```

El processor `SQL` puede sanitizar `userInput` antes de insertarlo en la query. No más SQL injection por olvidarte de usar prepared statements.

## Comparación rápida

| Método               | Legibilidad | Seguridad | Rendimiento |
| -------------------- | :---------: | :-------: | :---------: |
| Concatenación (+)    |     ⭐⭐      |     ❌     |     ⭐⭐⭐     |
| String.format()      |     ⭐⭐⭐     |     ❌     |     ⭐⭐      |
| StringBuilder        |      ⭐      |     ❌     |     ⭐⭐⭐     |
| **String Templates** |  **⭐⭐⭐⭐**   |   **✅**   |   **⭐⭐⭐**   |

## Cómo habilitarlo

String Templates es una **preview feature** en Java 21. Para usarlo:

```bash
javac --enable-preview --release 21 MiClase.java
java --enable-preview MiClase
```

En tu `pom.xml` o `build.gradle`, asegurate de habilitar preview features:

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-compiler-plugin</artifactId>
    <configuration>
        <release>21</release>
        <compilerArgs>
            <arg>--enable-preview</arg>
        </compilerArgs>
    </configuration>
</plugin>
```

## ¿Y ahora qué?

Oracle retiró String Templates en Java 23 (JEP 465). Sin reemplazo directo. Sin timeline para algo nuevo. El problema de construir strings de forma legible en Java sigue sin resolver oficialmente.

¿Qué aprendemos de esto?

1. **No uses preview features en producción.** Por algo se llaman preview. Esta es la prueba de que pueden desaparecer.
2. **El problema sigue siendo real.** Seguimos concatenando strings como en 2005. Java evolucionó en muchas cosas, pero en esto nos quedamos atrás.
3. **Kotlin, TypeScript, Python, Go** — todos resolvieron esto hace años. Java sigue sin hacerlo.

Si me preguntás a mí, String Templates era exactamente lo que Java necesitaba. Ojalá Oracle reconsidere y traiga algo similar. Pero hasta entonces, seguimos con `String.format()` y resignación.

**La moraleja: en Java, no te encariñes con las preview features.**
