---
title: "Día 20: YAGNI, la feature que programaste por las dudas"
description: "7 clases para un solo método de pago. PayPal y Crypto: TODO. Borró 300 líneas, todo siguió funcionando. Día 20 de #100ArchitectureDays."
tags: ["Java", "Architecture", "100ArchitectureDays"]
date: 2026-06-03
readTime: "7 min read"
image: "/blog/day-020-yagni-v2.webp"
day: 20
---

El dev nuevo llevaba una semana en el proyecto. Le asignaron un ticket: agregar validación de monto mínimo al pago. Algo simple. Abrió el paquete `payment` para orientarse y se encontró con esto:

```
├── PaymentStrategy.java           (interface)
├── CreditCardPaymentStrategy.java (implementación)
├── PayPalPaymentStrategy.java     (implementación: TODO)
├── CryptoPaymentStrategy.java     (implementación: TODO)
├── PaymentStrategyFactory.java    (factory)
├── PaymentStrategyConfig.java     (configuración)
└── PaymentStrategyResolver.java   (resolver)
```

Siete clases. Pasó diez minutos buscando cuál de las implementaciones se usaba en producción. Leyó el factory: un switch con tres cases, dos de los cuales lanzaban `UnsupportedOperationException("TODO: implement when needed")`. El resolver existía para "desacoplar" el factory del service. La configuración registraba las tres estrategias aunque dos no hacían nada.

Le preguntó a su tech lead cuándo se iban a implementar PayPal y Crypto.

"Eventualmente. Lo pusimos porque es bueno estar preparado."

¿Quién lo había pedido? Nadie. ¿Cuándo llegaría el requerimiento? Nadie sabía. El sistema había estado así desde el primer sprint, seis meses atrás.

## Por qué duele

El costo inmediato es la desorientación. El dev nuevo tardó más en entender el sistema de pagos que en resolver el ticket original. Eso no es un accidente: siete clases transmiten una señal de complejidad que no existe en la realidad del negocio.

Pero el costo que no se ve en el momento es el que acumula:

**Costo de mantenimiento.** Si la interfaz `PaymentStrategy` necesita un método nuevo, hay que implementarlo en las siete clases, incluyendo las dos que no hacen nada. Cada cambio genera ruido en el diff. Cada review tiene que leer código que no funciona.

**Costo de navegación.** Ctrl+Click sobre el método `process()` en `PaymentService` lleva a la interfaz. Desde ahí hay que descubrir cuál implementación se inyecta realmente. En un codebase activo, eso son tres clicks más y una búsqueda de la configuración de Spring. Multiplicado por todos los que tocan ese código en un año.

**Costo de testing.** Más clases significa más tests, más tiempo de CI, más superficie para falsos positivos. Las clases con `TODO` generan una pregunta en cada code review: ¿esto está probado? ¿Por qué no? ¿Debería estarlo?

**Costo de confianza.** Cuando un dev encuentra dos clases con `UnsupportedOperationException` en producción, la pregunta que le queda en la cabeza es "¿qué más hay acá que parece funcionar pero no funciona?" La duda contamina la lectura de todo lo demás.

El código que no existe no tiene ninguno de esos costos.

## La trampa

El arreglo que casi todos intentan cuando ven esto es agregar una tarea al backlog: "implementar PayPal". Así el TODO deja de parecer deuda y pasa a ser "trabajo planificado".

No resuelve nada. El código sigue ahí. La complejidad especulativa sigue confundiendo. Y la tarea del backlog vive en el cementerio de ítems que nunca pasan de `TO DO` a `DONE` porque el negocio siempre tiene prioridades más urgentes.

La segunda trampa es más sutil: "pero si llega el requerimiento de PayPal, ya tenemos la estructura". Suena razonable hasta que te das cuenta de que las abstracciones especulativas casi nunca coinciden con lo que realmente necesitás cuando llega el caso real. El requerimiento de PayPal llega con detalles concretos: flujo de redirección, webhooks de confirmación, estados intermedios, manejo de disputas. La interfaz que imaginaste hace seis meses sin ese contexto probablemente necesita cambiar de todas formas.

Prepararse para un futuro imaginado no ahorra tiempo. Solo desplaza el costo.

## La decisión y su porqué

El dev nuevo borró cinco de las siete clases. Quedó el servicio y la implementación concreta de tarjeta de crédito. Trescientas líneas menos.

```java
// LO QUE QUEDÓ
@Service
public class PaymentService {

    private final PaymentGateway gateway;

    public PaymentService(PaymentGateway gateway) {
        this.gateway = gateway;
    }

    public PaymentResult charge(BigDecimal amount, String cardToken) {
        validateAmount(amount);
        return gateway.charge(amount, cardToken);
    }

    public void refund(String transactionId) {
        gateway.refund(transactionId);
    }

    private void validateAmount(BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new InvalidPaymentException("Amount must be positive");
        }
    }
}
```

Una clase. Sin interfaces innecesarias. Sin factory. Sin resolver. Hace exactamente lo que el sistema necesita hoy.

El trade-off es real y vale nombrarlo: si mañana llega el requerimiento de PayPal, hay que refactorizar. Hay que extraer la interfaz, crear la implementación de tarjeta que ya existe, crear la nueva implementación de PayPal. Eso toma tiempo.

La apuesta de YAGNI es que ese costo de refactorización futura es menor que el costo acumulado de cargar con la abstracción especulativa hasta que llegue el caso real, o hasta que quede claro que nunca llega. Y esa apuesta casi siempre gana, por dos razones:

Primero, refactorizar código simple con tests en verde es rápido. El IDE hace el extract interface en dos segundos. Los tests te dicen si algo se rompió. Tenés contexto real del requerimiento concreto para diseñar la abstracción bien.

Segundo, las features especulativas tienen una tasa de mortalidad alta. El requerimiento de PayPal que era "inevitable" en el sprint 1 todavía no llegó en el sprint 24. El costo que se pagó seis meses fue real. El beneficio que se anticipaba nunca materializó.

La regla que viene de Kent Beck lo dice sin rodeos: *implementá lo mínimo que resuelva el problema de hoy*. No lo mínimo que pueda resolver el problema de mañana también.

## La regla

Antes de agregar una abstracción, la pregunta es concreta: ¿tengo dos casos de uso reales hoy que justifiquen esta interfaz?

No uno. No cero. Dos.

- Un método de pago: clase directa, sin interfaz.
- Dos métodos de pago: ahí sí, extraés la interfaz y el strategy tiene sentido.
- Tres métodos de pago: el pattern ya está, agregar es trivial.

Refactorizar de simple a abstracto cuando tenés el caso real es fácil. Tenés tests, tenés el código funcionando, tenés el requerimiento concreto para diseñar la abstracción que realmente necesitás. Refactorizar de abstracto-especulativo a algo útil es más difícil porque las abstracciones prematuras raramente encajan con lo que el negocio termina pidiendo.

Las señales en el código:

- Interfaces con una sola implementación (y no es para testing).
- Clases con `TODO: implement later` en producción.
- Factories que solo devuelven un tipo.
- Configuración para features que no existen.
- Parámetros que siempre reciben el mismo valor.

Cada una de esas es complejidad sin retorno. No es preparación, es deuda anticipada.

El código más mantenible no es el más extensible. Es el más simple. El que un dev nuevo puede leer en treinta segundos y decir "ya entendí qué hace". El framework interno que nadie usó no es una inversión. Es el costo de no haberle dicho que no a una idea antes de escribir la primera línea.

Borrar código es una feature.

---

Día 20 de **#100ArchitectureDays**. 
⭐ Si el contenido te resulta útil, una estrella en [github.com/alafourcadev/100-architecture-days](https://github.com/alafourcadev/100-architecture-days) ayuda a que más gente lo encuentre.
