---
title: "Día 19: data, manager, process y otros crímenes"
description: "El código se lee 10x más de lo que se escribe. Cada nombre vago que te ahorra 2 segundos al escribir le cuesta 30 a cada lector. Día 19 de #100ArchitectureDays."
tags: ["Java", "Architecture", "100ArchitectureDays"]
date: 2026-05-25
readTime: "7 min read"
image: "/blog/naming.png"
day: 19
---

Llegué a revisar un PR y había una clase llamada `ProcService`. Método principal: `proc()`. Parámetro: `ReqDTO d`. Variables internas: `u`, `lst`, `tmp`, `t`. Número mágico suelto: `0.9`.

Le pregunté al autor qué hacía la clase. Me miró, pensó dos segundos, y dijo: "procesa la orden, creo".

"Creo." Era su propio código. Lo había escrito esa semana.

Si el que escribe el código no puede describir qué hace sin leer cada línea, el que lo mantiene va a sufrir. Y el que lo mantiene en seis meses probablemente sea él mismo.

## Por qué duele

El código se lee diez veces más de lo que se escribe. No es metáfora, es la realidad de cualquier codebase que dura más de un sprint: cada línea que escribís va a ser leída por vos en tres meses, por el colega que agarra el ticket siguiente, por el junior que hace onboarding, por quien arregla el bug de producción a las 2am.

Cada abreviación que te ahorra dos segundos al escribir le cuesta treinta segundos a cada persona que pasa por esa línea. Multiplicá eso por la cantidad de personas, por la cantidad de veces que alguien toca ese archivo en un año. El costo no es visible en el momento de escribir, pero se acumula en silencio.

`d` te ahorra tipear doce letras. `orderRequest` le ahorra a cada lector futuro la pregunta "¿qué es `d`?". A largo plazo, el trade-off es brutal.

## La trampa

El arreglo que casi todos intentan primero es agregar comentarios:

```java
// Aplica el descuento al precio del ítem
if (d.getTyp() == 1) tmp *= 0.9;
```

El comentario no resuelve nada. Es evidencia del problema, no la solución. Si necesitás un comentario para explicar qué hace una variable o un bloque de código, el nombre está mal. El comentario le dice al siguiente lector "esto es confuso, pero no lo arreglé". Y cuando el código cambia, el comentario se queda desactualizado. Ahora tenés código confuso más un comentario incorrecto.

Los comentarios útiles explican el *porqué* de una decisión que no es obvia, no el *qué* de código que debería hablar por sí mismo.

## La decisión y su porqué

La solución es renombrar. No es glamorosa, pero es la única que cierra el problema.

**Las variables cuentan su historia:**

```java
// MAL
var u = ur.findById(d.getUid());
double t = 0;
var lst = pr.findByIds(d.getPids());

// BIEN
User customer = userRepository.findById(orderRequest.getUserId());
Money totalPrice = Money.ZERO;
List<Product> products = productRepository.findByIds(orderRequest.getProductIds());
```

`customer` te dice qué es. `u` te dice nada. El trade-off: tipear doce caracteres más al escribir; ahorrarle la pregunta "¿qué es esto?" a cada lector futuro. El IDE te autocompleta, el costo de tipear es casi cero.

**Los métodos declaran su intención:**

```java
// MAL
public RespDTO proc(ReqDTO d) { ... }

// BIEN
public OrderResponse processOrder(OrderRequest orderRequest) { ... }
```

`processOrder` no solo describe qué hace. Describe qué recibe y qué devuelve. La firma del método es la primera documentación que el lector va a ver. Cuando esa firma dice `proc(ReqDTO d)`, la única información que transmite es que hay algo que recibe algo.

El nombre es la API del código. Cuando elegís `processOrder` en lugar de `proc`, estás documentando la intención antes de que alguien abra la implementación. Ese es el valor: el lector entiende el propósito sin necesidad de descender al detalle.

**Los números mágicos tienen nombre:**

```java
// MAL
if (d.getTyp() == 1) tmp *= 0.9;
if (d.getTyp() == 2) tmp *= 0.85;

// BIEN
public enum DiscountType {
    STANDARD(0.10),
    PREMIUM(0.15),
    NONE(0.0);

    private final double percentage;

    public Money applyTo(Money amount) {
        return amount.multiply(1 - percentage);
    }
}
```

`typ == 1` no comunica nada. `DiscountType.STANDARD` comunica todo. El `0.9` escondido en el cuerpo del if es una regla de negocio sin nombre: nadie puede saber si es un descuento del 10%, un factor de conversión, o un error. `STANDARD(0.10)` con un método `applyTo` hace explícita la intención y la deja en un solo lugar para cuando cambie.

**La extracción con nombre:**

Cuando un bloque de código dentro de un método hace algo específico, extraerlo a un método privado con nombre descriptivo convierte el método padre en una lista de pasos de alto nivel. El lector entiende el flujo sin necesidad de leer cada detalle. Baja al detalle solo cuando necesita.

El PORQUÉ de todo esto: nombrar bien no es vanidad. Es la diferencia entre un equipo que avanza y uno que pasa la mitad del sprint descifrando código que ya existe. El tiempo que "ahorrás" usando nombres cortos lo pagás multiplicado cada vez que alguien tiene que entender ese código. No es productividad, es deuda diferida.

## La regla

Antes de hacer push, leé tu código como si fueras un junior que acaba de entrar al equipo y no puede preguntarle a nadie. ¿Podés entender qué hace cada método sin leer su implementación? ¿Podés entender qué representa cada variable sin rastrear dónde se asignó?

Si la respuesta es no, renombrá. El IDE hace rename en dos segundos. No necesita ser perfecto, necesita ser claro.

La señal precisa: si necesitás un comentario para explicar qué hace una variable, el nombre de la variable está mal. El comentario es el síntoma. El renombre es el tratamiento.

---

Día 19 de **#100ArchitectureDays**. El código completo antes/después está en el repo.

⭐ Si el contenido te resulta útil, una estrella en [github.com/alafourcadev/100-architecture-days](https://github.com/alafourcadev/100-architecture-days) ayuda a que más gente lo encuentre.
