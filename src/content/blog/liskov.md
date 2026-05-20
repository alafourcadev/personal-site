---
title: "Día 17: Liskov, cuando heredar miente"
description: "Penguin extends Bird. En runtime, fly() explota. LSP: la herencia biologica no es herencia de comportamiento. Dia 17 de #100ArchitectureDays."
tags: ["Java", "Spring Boot", "Architecture", "100ArchitectureDays"]
date: 2026-05-20
readTime: "7 min read"
image: "/blog/liskov.png"
day: 17
---

`BirdFlightService` recibe una `List<Bird>`, itera, y llama `fly()` en cada elemento. El contrato lo promete. El cliente lo asume con razón. Todo funciona en el happy path.

Hasta que alguien agrega un `Penguin` a la lista.

```java
public void flyAll(List<Bird> birds) {
    for (Bird bird : birds) {
        bird.fly(); // UnsupportedOperationException si bird es Penguin
    }
}
```

El test lo documenta exactamente:

```java
@Test
@DisplayName("ANTES: adding a Penguin to the list explodes at runtime -- LSP violation")
void penguinExplodesAtRuntime() {
    List<Bird> birds = List.of(new Sparrow(), new Eagle(), new Penguin());

    assertThrows(
            UnsupportedOperationException.class,
            () -> service.flyAll(birds)
    );
}
```

El cliente no hizo nada mal. Llamó el contrato que `Bird` publicó. La jerarquía le mintió.

## Por qué duele

El `Bird` original prometía `fly()` para cualquier subtipo:

```java
public abstract class Bird {
    public abstract void fly();
}
```

`Penguin` hereda de `Bird` porque un pingüino es un ave. Correcto biológicamente. Y entonces implementa el contrato de la única manera posible:

```java
public class Penguin extends Bird {
    @Override
    public void fly() {
        throw new UnsupportedOperationException(
            "Penguins cannot fly. Substituting Bird with Penguin breaks the client.");
    }
}
```

El costo real no es el `UnsupportedOperationException` en sí. Es lo que viene después: el código defensivo que empieza a acumularse en el cliente. Primero un `try/catch`. Después un `instanceof`. Después una condición en el llamador para verificar si el ave puede volar antes de llamar `fly()`. Cada uno de esos parches es evidencia de que el diseño rompió el contrato.

El error aparece en producción, no en tiempo de compilación. No hay nada en el código del cliente que sugiera que algo puede ir mal. El tipo dice `Bird`, el método existe, el compilador no avisa.

## La trampa

El arreglo que casi todos intentan primero es defensivo:

```java
public void flyAll(List<Bird> birds) {
    for (Bird bird : birds) {
        if (bird instanceof Penguin) continue; // skip penguins
        bird.fly();
    }
}
```

Parece resolver el problema inmediato. No lanza excepción. Los tests pasan.

El problema es que escala mal por dos razones concretas. Primera: cada ave no voladora que se incorpore al sistema requiere que alguien recuerde actualizar este bloque. `Ostrich`, `Kiwi`, `Cassowary`. El cliente no debería conocer la taxonomía de aves para funcionar correctamente. Segunda: el `instanceof` es una señal de que la abstracción está fallando. Cuando el cliente necesita inspeccionar el tipo concreto para decidir cómo usarlo, la interfaz no refleja la realidad del dominio.

## La decisión y su porqué

El rediseño parte de una pregunta: ¿qué saben hacer todos los pájaros sin excepción?

No volar. No todos vuelan. Describirse, sí. Eso es lo que va en `Bird`:

```java
public abstract class Bird {
    private final String name;

    protected Bird(String name) {
        this.name = name;
    }

    public String getName() {
        return name;
    }

    public String describe() {
        return "Bird: " + name;
    }

    // sin fly() porque no es una capacidad universal
}
```

Las aves que vuelan heredan de un subtipo más específico:

```java
public abstract class FlyingBird extends Bird {
    protected FlyingBird(String name) {
        super(name);
    }

    public abstract void fly();
}
```

`Penguin` hereda de `Bird` directamente. La capacidad de volar no existe en su tipo:

```java
public class Penguin extends Bird {
    public Penguin() {
        super("Penguin");
    }

    public void swim() {
        System.out.println("[" + getName() + "] Swimming at full speed.");
    }

    // fly() no existe. El compilador rechaza pasarle un Penguin a BirdFlightService.
}
```

`BirdFlightService` ahora pide exactamente lo que necesita:

```java
public void flyAll(List<FlyingBird> birds) {
    for (FlyingBird bird : birds) {
        bird.fly(); // garantia: nunca lanza UnsupportedOperationException
    }
}
```

No es posible pasar un `Penguin` a `flyAll`. El compilador lo rechaza. El error desaparece en tiempo de compilación, no en producción a las 3am.

El PORQUÉ es el principio: un subtipo debe poder sustituir a su padre en cualquier contexto sin cambiar el comportamiento observable del sistema. `Penguin` no puede sustituir a `Bird` cuando el cliente asume `fly()`. La jerarquía estaba modelando una relación taxonómica ("un pingüino es un ave") cuando el sistema necesitaba una relación de comportamiento ("un ave que puede volar"). Son dos cosas distintas.

El trade-off es real: la jerarquía creció. Hay más tipos que entender. Pero la complejidad adicional es honesta: refleja que no todas las aves son iguales respecto a volar, que es exactamente la realidad del dominio. Lo que se gana a cambio es que el sistema de tipos hace imposible el error. No "poco probable", no "documentado", sino imposible por construcción.

## La regla

Si tu subclase lanza `UnsupportedOperationException` en un método heredado, o tiene métodos heredados que no hacen nada porque "no aplica", la jerarquía está mal diseñada. No porque sea feo, sino porque estás prometiendo un contrato que no podés cumplir.

La señal es específica: cuando un subtipo necesita violar el contrato del padre para existir, la herencia está modelando la relación equivocada. La solución no es `instanceof`, no es `try/catch`, no es documentar la excepción. Es rediseñar la jerarquía para que los contratos que se publican sean contratos que todos los subtipos puedan cumplir.

La pregunta que hay que hacerse antes de heredar:

**¿Puede este subtipo sustituir al padre en cualquier contexto que el cliente espera, sin sorpresas?**

Si la respuesta es "depende del contexto" o "a veces", la herencia está mintiendo. Eso no es un problema de implementación, es un problema de diseño.

---

Día 17 de **#100ArchitectureDays**. El código completo antes/después con los tests está en el repo.

⭐ Si el contenido te resulta útil, una estrella en [github.com/alafourcadev/100-architecture-days](https://github.com/alafourcadev/100-architecture-days) ayuda a que más gente lo encuentre.
