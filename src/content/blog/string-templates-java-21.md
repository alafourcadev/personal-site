---
title: "String Templates en Java 21"
description: "Simplificando la Manipulación de Cadenas con la nueva característica de Java 21."
tags: ["Java"]
date: 2024-07-05
readTime: "5 min read"
image: "/blog/string-templates-java-21.webp"
---

Java 21 trajo una de las características más esperadas por la comunidad: **String Templates**. Una forma segura, legible y elegante de construir cadenas de texto.

## El problema con lo que tenemos

Hasta ahora, teníamos tres formas principales de construir strings en Java, y ninguna era ideal:

### Concatenación con +

```java
String mensaje = "Hola " + nombre + ", tu pedido #" + pedidoId + " tiene " + items + " items.";
```

Funciona, pero es difícil de leer. Cuando tenés muchas variables, se vuelve un desastre.

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

Verbose. Nadie quiere escribir esto para un simple mensaje.

## String Templates al rescate

Con Java 21, podemos usar String Templates (preview feature):

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

## Conclusión

String Templates simplifica algo que hacemos decenas de veces al día: construir strings. Con mejor legibilidad, seguridad contra inyección, y la capacidad de crear processors personalizados.

Si ya estás en Java 21, probalo. Es una de esas features que una vez que empezás a usar, no querés volver atrás.
