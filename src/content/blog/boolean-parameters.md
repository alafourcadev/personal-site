---
title: "Día 22: el método(true, false, true) que nadie entiende"
description: "Un boolean en la firma casi siempre significa que el método hace dos cosas. Tres técnicas para eliminar flag arguments en Java. #100ArchitectureDays."
tags: ["Java", "Architecture", "100ArchitectureDays"]
date: 2026-06-22
readTime: "8 min read"
image: "/blog/day-022-boolean-parameters-v2.webp"
day: 22
---

Era code review de rutina. El PR llegó con tres call-sites nuevas en el servicio de notificaciones de un e-commerce:

```java
notificationService.dispatch(order, true,  false, true,  false);
notificationService.dispatch(order, false, true,  true,  false);
notificationService.dispatch(order, true,  false, false, true);
```

Tres líneas. Tres enigmas. Para saber qué hace cada una, tenés que abrir `NotificationService.dispatch()` y leer la firma:

```java
public NotificationResult dispatch(Order order,
                                   boolean useEmail,
                                   boolean useSms,
                                   boolean highPriority,
                                   boolean ccAdmin)
```

Recién ahí, con la definición delante, podés intentar descifrar la primera línea: email sí, SMS no, prioridad alta, admin sin copia. Quizás. Si no te equivocaste en el orden.

Eso es un **flag argument**: un parámetro booleano que controla el comportamiento interno de un método. Y el compilador, ante todo esto, no dice absolutamente nada.

## Por qué duele más de lo que parece

La ilegibilidad no es el problema principal. Es la primera señal de algo más serio.

**Señal 1 — la call-site no se puede leer sin abrir la definición.** `dispatch(order, true, false, true, false)` no le transmite nada al lector. El `true` en posición 2 y el `true` en posición 4 son visualmente idénticos, pero significan cosas completamente distintas. Cada vez que alguien lee esa línea tiene que hacer un salto mental al lugar donde está la firma.

**Señal 2 — el compilador no te protege de swaps accidentales.** Swapeás `useEmail` y `useSms` y tenés el mismo tipo en ambas posiciones: `boolean`. El compilador compila. Los tests que pasaban siguen pasando si los escribiste pensando en el comportamiento correcto. El bug entra en producción silencioso.

**Señal 3 — el método hace más de una cosa.** Cuando un booleano controla qué camino toma el código, el método tiene al menos dos comportamientos distintos. `dispatch()` elige canal, configura prioridad y decide destinatarios, todo en un solo lugar. Cada responsabilidad extra es una razón extra para que el método cambie.

**Señal 4 — los estados inválidos son silenciosos.** La combinación `dispatch(order, false, false, true, true)` compila y corre. En la implementación real: el admin recibe la notificación aunque el cliente no esté en ningún canal. Un comportamiento sorpresivo que ningún tipo detecta ni previene.

Y la proyección más previsible: el siguiente sprint agrega notificaciones push. El sprint que sigue, WhatsApp. El camino de los booleanos lleva directo a `dispatch(order, true, false, true, false, true, false, true)`.

## La trampa: nombrar los booleanos en el call-site

El arreglo que casi todos intentan primero al ver esto es introducir variables con nombre antes de la llamada:

```java
boolean useEmail    = true;
boolean useSms      = false;
boolean highPriority = true;
boolean ccAdmin     = false;
notificationService.dispatch(order, useEmail, useSms, highPriority, ccAdmin);
```

Es mejor que nada — al menos el call-site se entiende. Pero no resuelve nada estructural.

El método sigue haciendo más de una cosa. El compilador sigue sin protegerte: podés swapear `useEmail` y `useSms` en el orden de los argumentos y todo compila. Los estados inválidos siguen siendo representables. Y el siguiente boolean sigue siendo igual de fácil de agregar.

Nombrar la confusión no la elimina. La oculta un nivel más abajo.

## La decisión y su porqué: tres técnicas, tres contextos

No hay una sola respuesta. Hay tres técnicas, y la elección depende de qué hace el booleano que estás eliminando.

### Técnica 1 — separar en métodos con nombre de intención

Cuando el booleano elige entre dos comportamientos distintos, el método hace dos cosas. La solución es hacerlos dos métodos.

```java
// ANTES: el booleano en posición 2 y 3 elige el canal
notificationService.dispatch(order, true,  false, true, false); // email
notificationService.dispatch(order, false, true,  true, false); // SMS
notificationService.dispatch(order, true,  true,  true, false); // ambos

// DESPUÉS: el nombre del método es el canal
notificationService.notifyByEmail(order, options);
notificationService.notifyBySms(order, options);
notificationService.notifyByEmailAndSms(order, options);
```

La call-site se lee como una frase. No hay nada que interpretar. El canal ya no se "configura" — se elige eligiendo el método.

**Por qué funciona:** el nombre del método es el canal. La intención del llamador queda registrada en el código, no en un comentario.

**Trade-off:** más métodos públicos en la interfaz. Vale la pena cuando los comportamientos son distintos y estables. Si el canal fuera completamente dinámico — definido en runtime desde una config externa — un enum o un parameter object sería más apropiado.

### Técnica 2 — reemplazar el booleano por un enum con significado de dominio

Cuando el booleano no elige entre dos comportamientos radicalmente distintos sino que ajusta uno — como `highPriority` — la solución es darle nombre al estado con un enum.

```java
// ANTES
notificationService.dispatch(order, true, false, true,  false); // highPriority=true
notificationService.dispatch(order, true, false, false, false); // highPriority=false

// DESPUÉS
notificationService.notifyByEmail(order, NotificationOptions.builder()
        .priority(NotificationPriority.HIGH)
        .build());
```

`NotificationPriority.HIGH` y `NotificationPriority.NORMAL` son tipos distintos. El compilador ahora sí puede detectar errores. Si mañana aparece un tercer nivel `CRITICAL`, se agrega al enum — los call-sites existentes no cambian. Con `boolean highPriority`, agregar ese tercer estado requeriría romper la firma del método.

**Por qué funciona:** el enum convierte un dato primitivo en un concepto de dominio. El tipo lleva la intención, no el valor.

**Trade-off:** es un tipo extra en el proyecto. Para flags que nunca van a tener más de dos estados y son puramente técnicos (como un flag interno de infraestructura), el enum puede ser sobrediseño. Para conceptos de dominio reales, siempre vale.

### Técnica 3 — parameter object con builder y factory methods de dominio

Cuando varios booleanos y opciones forman un grupo cohesivo que siempre viaja junto, el parameter object los agrupa. El builder le da nombre a cada opción en el call-site. Los factory methods encapsulan los presets de dominio.

```java
// ANTES: cuatro booleanos, intención opaca
notificationService.dispatch(order, true, false, false, true);

// DESPUÉS: el objeto de opciones dice lo que pasa
notificationService.notifyByEmail(order, NotificationOptions.builder()
        .includeAdmin(true)
        .build());

// O mejor aún, con un preset de dominio que encapsula la decisión:
notificationService.notifyByEmailAndSms(order, NotificationOptions.forFraudAlert());
```

`NotificationOptions.forFraudAlert()` encapsula tres decisiones: prioridad alta, incluir admin, ambos canales. El código de negocio en el call-site no necesita saber cuáles — solo sabe que es una alerta de fraude.

```java
// Los tres factory methods del dominio — del código real del ejercicio:
NotificationOptions.forConfirmation()  // prioridad normal, solo cliente
NotificationOptions.forShipment()      // prioridad alta, solo cliente
NotificationOptions.forFraudAlert()    // prioridad alta, incluye admin
```

**Por qué funciona:** agregar una opción nueva (`includePdf`, `replyTo`) no cambia ningún call-site existente — el campo tiene un default razonable. Los states inválidos se pueden prevenir en el builder. Las combinaciones de dominio viven en un lugar.

**Trade-off:** más código que un booleano. Justificado cuando las opciones son 3+ y tienen semántica de dominio real. Para dos booleanos simples y puramente técnicos, puede ser sobrediseño — la Técnica 1 (métodos separados) suele ser suficiente.

## La call-site antes y después

```java
// ANTES: tres enigmas en producción
notificationService.dispatch(order, true,  false, true,  false);
notificationService.dispatch(order, false, true,  true,  false);
notificationService.dispatch(order, true,  false, false, true);

// Combinación inválida que compila sin error:
notificationService.dispatch(order, false, false, true, true);
// → admin recibe aunque el cliente no esté en ningún canal

// DESPUÉS: tres frases
notificationService.notifyByEmail(order, NotificationOptions.forConfirmation());
notificationService.notifyBySms(order, NotificationOptions.forShipment());
notificationService.notifyByEmailAndSms(order, NotificationOptions.forFraudAlert());

// La combinación "admin sin canal de cliente" ya no existe.
// notifyByEmail() siempre incluye al cliente. No hay forma de construirla.
```

## La regla

| Métrica | Antes | Después |
|---|---|---|
| Parámetros booleanos en la firma | 4 | 0 |
| Combinaciones posibles | 16 (2⁴) | todas representables con nombre |
| Call-site legible sin abrir la definición | No | Sí |
| El compilador previene swap accidental de booleans | No | Sí (tipos distintos) |
| Agregar "notificación push" requiere cambiar firmas | Sí (5.° boolean) | No (método nuevo + opción) |
| Estado inválido (admin sin canal cliente) | Representable y silencioso | Irrepresentable |

La señal de alerta en el código es cualquier firma con `boolean` que no sea "¿está habilitado este objeto?" — una propiedad del objeto, no una instrucción al método. Cuando el booleano le dice al método *cómo comportarse*, el método tiene responsabilidades que no le corresponden.

Las tres técnicas en orden de aplicación:

1. **Métodos con intención** — cuando el booleano elige entre dos comportamientos: hacé dos métodos. La Técnica 1 es la más frecuente porque el caso más común es exactamente ese.
2. **Enum** — cuando el booleano representa un estado de dominio con nombre: dale nombre. Usás un enum, no un boolean, porque el dominio tiene semántica que un `true/false` no puede expresar, y porque el número de estados puede crecer.
3. **Parameter object** — cuando son varias opciones relacionadas que viajan juntas: agrupalas. Elegís esta técnica cuando la combinación de opciones tiene semántica de dominio propia (como `forFraudAlert()`), no cuando son opciones técnicas independientes.

El objetivo no es eliminar la configuración. Es que la call-site se lea como una frase, y que los estados inválidos sean irrepresentables en el tipo — no en la documentación.

Un booleano en la firma no es un problema de estética. Es una señal de que el método tiene demasiadas responsabilidades y de que el tipo no está trabajando por vos.

---

Si encontrás un patrón similar en tu código, los posts de [naming](/blog/naming) y [God Object y SRP](/blog/god-object-srp) exploran otras formas en que los métodos acumulan responsabilidades que no les corresponden. Y si venís del día anterior, [composición sobre herencia](/blog/composicion-sobre-herencia) muestra cómo el mismo principio — no empaquetar decisiones ortogonales en la misma estructura — aplica a las jerarquías de clases.

Día 22 de **#100ArchitectureDays**. El código completo — implementación ANTES con 4 booleanos, las tres técnicas DESPUÉS, y 20 tests con casos que incluyen el estado inválido — está en el repo.

⭐ Si el contenido te resulta útil, una estrella en [github.com/alafourcadev/100-architecture-days](https://github.com/alafourcadev/100-architecture-days) ayuda a que más gente lo encuentre.
