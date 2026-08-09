---
title: "Checkpoint Día 23: el mapa de los 10 principios de Clean Code"
description: "10 principios de clean code no son 10 reglas sueltas. Son un mapa. Cómo SRP, SOLID, naming, YAGNI y composición atacan el mismo problema raíz. #100ArchitectureDays."
tags: ["Java", "Architecture", "100ArchitectureDays"]
date: 2026-06-23
readTime: "9 min read"
image: "/blog/day-023-checkpoint-clean-code-v2.webp"
day: 23
---

Era una tarde de retrospectiva. El equipo había trabajado tres meses en el mismo codebase y alguien preguntó algo que sonó inocente: "¿por qué cada vez que tocamos el `OrderService` se rompe algo en otro lado?"

Nadie supo responder. Y eso es exactamente el problema.

Los días 13 a 22 de este challenge cubrieron 10 principios de clean code. Cada uno atacó un síntoma distinto: la clase que hace todo, el acoplamiento que explota en cascada, la abstracción que confunde más de lo que ayuda, el boolean que nadie entiende. Diez posts, diez diagnósticos, diez soluciones.

Pero hay algo que no aparece en ningún post individual: la conexión entre todos. Por qué estos principios existen juntos. Qué problema raíz atacan todos al mismo tiempo. Y cómo un developer los usa como criterio en el momento en que toma una decisión de diseño, no como checklist sino como mapa.

Eso es lo que hace este checkpoint.

## Por qué duele tener un mapa roto

El `OrderService` que se rompe con cada cambio no es un accidente. Es el resultado predecible de una serie de decisiones que, tomadas de manera aislada, parecen razonables.

El costo no es solo el bug. Es el tiempo perdido buscando dónde está el problema. Es el miedo que instala el equipo antes de cada deploy. Es la feature que tarda el triple de lo que debería porque nadie entiende las dependencias reales del sistema. Es el developer nuevo que tarda tres semanas en hacer su primer commit productivo.

Y todo eso se acumula en silencio, sin que ningún dashboard se ponga rojo, sin que nadie grite. Los problemas de performance los ves en el percentil 99. Los problemas de diseño los sentís en la fricción de cada cambio.

## La trampa: aprender los principios en silos

El arreglo que casi todos intentan primero es memorizarlos de manera aislada. SRP significa "una sola responsabilidad". OCP significa "abierto para extensión, cerrado para modificación". LSP significa... algo sobre herencia. Se aprenden como reglas, se citan en code reviews, y no cambia nada.

La razón por la que no cambia nada es que los principios aplicados como reglas sueltas no te dan criterio. Te dan excusas. Podés justificar cualquier decisión citando un principio si no entendés por qué existe ese principio.

El mapa no son los principios. Son las conexiones entre ellos.

## La decisión: leer el mapa, no la lista

Todos los principios de estos 10 días atacan la misma causa raíz: **el costo del cambio**. Un codebase limpio no es uno donde el código es bonito. Es uno donde el costo de hacer el próximo cambio es predecible y acotado.

Cada principio reduce ese costo de una manera específica. Y cuando los ponés juntos en un mapa, ves que se dividen en tres capas de decisión:

### Capa 1: qué poner en cada unidad de código

[SRP (Día 13)](/blog/god-object-srp) y [acoplamiento y cohesión (Día 14)](/blog/coupling-cohesion) responden la misma pregunta desde ángulos distintos: ¿qué código va junto y qué código va separado?

SRP dice que una clase debería tener una sola razón para cambiar. El God Object viola eso porque acumula responsabilidades hasta que cualquier cambio en el dominio lo toca. El costo: coordinar cambios entre 8 features distintas cada vez que modificás esa clase.

Acoplamiento y cohesión son la misma idea con más precisión: alta cohesión (cosas relacionadas juntas) y bajo acoplamiento (dependencias mínimas entre unidades). Cuando cambiás un DTO y explotan 10 clases, el acoplamiento es el diagnóstico. Separar modelos por capa, con un API model, un domain model y un persistence model, es la solución porque cada modelo cambia por razones propias.

**La conexión:** SRP te da el criterio de decisión. Acoplamiento/cohesión te da el mecanismo para aplicarlo.

### Capa 2: cómo estructurar las relaciones entre unidades

[Open/Closed (Día 16)](/blog/open-closed), [Liskov (Día 17)](/blog/liskov), [Dependency Inversion (Día 18)](/blog/dependency-inversion) y [composición sobre herencia (Día 21)](/blog/composicion-sobre-herencia) responden una pregunta distinta: ¿cómo conectar las piezas para que el sistema pueda crecer sin que cada extensión rompa lo que ya funciona?

OCP dice que agregar un procesador de pago nuevo no debería requerir tocar el código existente, porque si lo tocás introducís riesgo en algo que ya andaba. La solución es que el código existente dependa de una abstracción, y la extensión sea una implementación nueva de esa abstracción.

Liskov refina eso: si una subclase no puede cumplir el contrato de la clase base, la jerarquía está mal diseñada. El contrato no es solo la firma del método: es el comportamiento esperado. Cuando heredar miente, el principio de sustitución lo detecta.

Dependency Inversion conecta las piezas: los módulos de alto nivel no deberían depender de los de bajo nivel, sino de abstracciones. En la práctica: tu service no debería depender de `JpaRepository` directamente, sino de una interfaz de repositorio que vos definís. La razón es que el módulo de alto nivel debería poder existir y testearse sin saber que hay una base de datos atrás.

Y composición sobre herencia resuelve el caso donde la herencia se usa para reutilizar código en vez de para modelar tipos. Una jerarquía de 4 niveles que crece un nivel más con cada combinación nueva no está modelando el dominio: está modelando combinaciones. La composición te da esas combinaciones sin que el árbol explote.

**La conexión:** estos cuatro principios trabajan juntos para hacer el sistema extensible. OCP define el objetivo. LSP define el contrato. DIP define la dirección de las dependencias. Composición define cuándo usar herencia y cuándo no.

### Capa 3: cómo el código comunica intención

[La abstracción correcta (Día 15)](/blog/wrong-abstraction), [naming (Día 19)](/blog/naming), [YAGNI (Día 20)](/blog/yagni) y [parámetros booleanos (Día 22)](/blog/boolean-parameters) responden la pregunta más subestimada: ¿el código le dice al próximo developer qué hace y por qué?

El naming no es estética. Es la capa donde el código comunica intención sin que el lector tenga que ejecutarlo en su cabeza. Un método `processData()` te dice nada. Un método `calculateTax()` o `applyFraudGuard()` te dice exactamente qué hace. La razón de invertir en naming es que el código se lee 10 veces más de lo que se escribe.

La abstracción incorrecta es el error inverso: unificar dos cosas que parecen iguales pero cambian por razones distintas. El parámetro `isSpecialCase` que apareció tres semanas después de la abstracción es la señal. DRY es un principio de conocimiento, no de texto: si dos funciones parecen iguales pero representan reglas de negocio distintas, duplicarlas es correcto.

YAGNI ataca el costo de mañana que nadie pagó: las 7 clases para soportar PayPal, Crypto y transferencias bancarias que todavía no están en el roadmap. El costo real no es solo el tiempo de escribirlas. Es el costo de mantener, testear y modificar código que no tiene usuarios todavía. Cada línea que no existe no puede romperse.

Y los parámetros booleanos son el síntoma más inmediato de que un método hace demasiadas cosas: `dispatch(order, true, false, true, false)` no comunica nada. Cuando un booleano controla el comportamiento de un método, el método tiene responsabilidades que no le corresponden, lo que nos vuelve directamente a SRP.

**La conexión:** estos cuatro principios reducen el costo cognitivo de entender el sistema. No el costo de ejecutarlo: el costo de razonarlo.

## El mapa completo: una vista desde arriba

Si los ponés todos juntos, el mapa es este:

```
PROBLEMA RAÍZ: el costo del cambio es impredecible
       │
       ├── Capa 1: ¿qué va junto?
       │   ├── SRP → una razón para cambiar por clase
       │   └── Acoplamiento/Cohesión → cosas relacionadas juntas, dependencias mínimas
       │
       ├── Capa 2: ¿cómo se conectan?
       │   ├── Open/Closed → extender sin tocar lo que anda
       │   ├── Liskov → heredar sin mentir
       │   ├── Dependency Inversion → depender de abstracciones, no de implementaciones
       │   └── Composición > Herencia → combinaciones sin árbol infinito
       │
       └── Capa 3: ¿qué comunica?
           ├── Abstracción correcta → unificar lo que cambia junto, separar lo que no
           ├── Naming → intención explícita en el código
           ├── YAGNI → no pagar el costo de mañana hoy
           └── Parámetros booleanos → un método, una cosa
```

Lo que conecta las tres capas es siempre la misma pregunta: **¿qué pasa cuando el dominio cambie mañana?** Un principio de clean code no es una regla de estética. Es una apuesta sobre cómo va a evolucionar el sistema.

## Las tensiones que el mapa revela

El mapa también revela algo que los posts individuales no muestran: algunos principios se tensan entre sí, y reconocer esa tensión es lo que distingue el criterio del dogma.

**YAGNI vs. Open/Closed.** OCP dice que el sistema debería ser extensible sin modificación. YAGNI dice que no construyas lo que no necesitás. Si diseñás para extensión de un caso de uso que no existe todavía, estás pagando el costo de OCP sin cobrar el beneficio. La resolución: diseñá para OCP cuando el patrón de extensión ya apareció una vez. Si solo apareció en tu imaginación, es YAGNI.

**DRY vs. Abstracción correcta.** DRY dice no te repitas. La abstracción incorrecta dice que unir lo que no debería unirse es peor que duplicar. La resolución: DRY aplica a conocimiento, no a texto. Si dos funciones parecen iguales pero capturan reglas de negocio distintas, son dos conocimientos distintos. Duplicá el texto, no el conocimiento.

**Composición vs. Liskov.** La composición dice que preferís colaboradores sobre jerarquías. Liskov dice que si usás herencia, respetá el contrato. No se contradicen: se ordenan. Usá composición cuando necesitás combinaciones de comportamiento; usá herencia solo cuando tenés variación de tipo genuina, y ahí sí aplicá Liskov.

Estas tensiones no son defectos del sistema. Son las señales que indican que estás ante una decisión de diseño real.

## La regla que cierra el arco

Después de 10 días y 10 principios, hay una sola pregunta que los activa a todos:

**¿Cuánto cuesta el próximo cambio?**

Si la respuesta incluye "hay que tocar 6 clases", "no sé qué se puede romper", "hay que entender la jerarquía completa antes de hacer nada", o "primero tenés que encontrar dónde está esa lógica", alguno de estos principios no se está aplicando.

No para hacer el código más bonito. Para hacer el costo del cambio predecible. Ese es el contrato que el diseño limpio le ofrece al equipo.

El principio generalizable: cada decisión de diseño es una apuesta sobre el futuro. Los principios de clean code no son reglas: son heurísticas calibradas por décadas de coste real. Usarlos como mapa, no como checklist, es la diferencia entre aplicarlos con criterio y aplicarlos como ritual.

---

Si llegaste hasta acá, los posts individuales de cada principio están todos vinculados a lo largo de este artículo. Cada uno tiene el código completo del ejercicio, el diagnóstico del problema real, y el razonamiento detrás de la solución.

Los 10 principios ya están en el repo. El Día 24 arranca un bloque nuevo.

⭐ Si el contenido te resulta útil, una estrella en [github.com/alafourcadev/100-architecture-days](https://github.com/alafourcadev/100-architecture-days) ayuda a que más gente lo encuentre.
