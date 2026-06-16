---
title: "Día 21: extends te encierra — composición te libera"
description: "Visa Infinite rompió una jerarquía de 4 niveles: Level-5, flag o copy-paste, todas trampas. La composición gana sobre la herencia. #100ArchitectureDays."
tags: ["Java", "Architecture", "100ArchitectureDays"]
date: 2026-06-12
readTime: "8 min read"
image: "/blog/day-021-composicion-sobre-herencia-v2.webp"
day: 21
---

Era viernes a las 5pm. El product manager dejó caer el requerimiento con total tranquilidad: "Visa Infinite no debería pagar comisión de tarjeta, solo la de conversión de divisas". Dos frases. Nada del otro mundo.

El dev abrió el paquete `payment`. Lo que vio:

```
BasePaymentProcessor         ← Nivel 1: logging + validación
└── CardPaymentProcessor     ← Nivel 2: fraud check + comisión 1.5%
    └── InternationalCardProcessor  ← Nivel 3: conversión de divisas + 2% FX
        ├── VisaInternationalProcessor      ← Nivel 4: routing Visa
        └── MastercardInternationalProcessor ← Nivel 4: routing Mastercard
```

Cuatro niveles. Dos hojas. Prolijo, en teoría. El problema: `CardPaymentProcessor` aplica la comisión del 1.5% de manera fija. No hay parámetro. No hay override. La comisión está quemada en el `doProcess()` del nivel 2, y todos los nodos del árbol la heredan.

Para hacer Visa Infinite sin comisión, las opciones eran tres. Ninguna era buena.

## Por qué duele

La jerarquía tenía cuatro años. Funcionaba. Los tests pasaban. Y en cuatro años nadie había necesitado una combinación que el árbol no modelaba. Hasta ahora.

**Opción A — flag en el nodo base:** agregar `boolean waiveFee` a `CardPaymentProcessor` y meter un `if` adentro. La clase de nivel 2 se convierte en un objeto de configuración con comportamiento condicional. El problema es que cada flag que agregás es una bifurcación que todos los descendientes heredan, hayan pedido esa bifurcación o no. Dos meses después hay tres flags. El método `doProcess()` tiene cuatro `if` anidados. Nadie entiende qué combinación de flags activa qué comportamiento.

**Opción B — Level 5:** crear `VisaInfiniteInternationalProcessor extends VisaInternationalProcessor`. El árbol crece hacia abajo. El nodo nuevo hereda todo del nivel 4, que a su vez heredó todo del 3, del 2, del 1. La hoja concreta implementa una operación de tres líneas y arrastra seis campos que no pidió. Cuando AmEx también pida sin comisión, hay otro nodo en el nivel 5. Cuando Mastercard Infinite pida lo mismo, otro más. El árbol no modela el dominio: modela combinaciones que le corresponden a otra abstracción.

**Opción C — copy-paste:** sobreescribir `doProcess()` en `VisaInternationalProcessor` y copiar el fraud check a mano. El mismo código en dos lugares. En seis meses alguien actualiza el fraud check en el original y olvida el clon. Bug silencioso en producción.

El costo real no era el viernes a las 5pm. Era lo que venía después: AmEx, Discover, procesadores sin fraud check para ciertos clientes enterprise, transferencias bancarias que necesitan conversión de divisas pero no comisión de tarjeta. Cada combinación nueva es un nodo nuevo en el árbol. El árbol no para de crecer.

## La trampa

El arreglo que casi todos intentan primero es la Opción B: crear la subclase del nivel 5. Es rápido, es localizado, el sprint cierra.

La razón por la que parece razonable es que la herencia tiene una forma visual que da sensación de orden. La carpeta muestra los niveles, la jerarquía "explica" el dominio. Extenderla un nivel más parece la operación natural dentro del sistema.

Lo que no se ve en el momento es la invariante que viola: cada nodo del árbol hereda todo lo que está arriba, haya sido diseñado para ese nodo o no. `VisaInternationalProcessor` hereda `processedCount` de `BasePaymentProcessor`, hereda `CARD_PROCESSING_FEE_PERCENT` de `CardPaymentProcessor`, hereda `getConversionRate()` de `InternationalCardProcessor`. Una hoja concreta que implementa tres líneas carga con la historia de cuatro generaciones.

Cuando el árbol tiene cuatro niveles y la mitad de los campos heredados no tienen uso real en las hojas, la jerarquía dejó de modelar tipos y pasó a modelar reutilización de código. Esa es la señal. La herencia es la herramienta correcta para variación de tipo ("un Pingüino ES UN Pájaro"), no para composición de comportamientos ("un procesador con fraud check Y conversión de divisas Y sin comisión").

## La decisión y su porqué

El rediseño parte de una pregunta: ¿cuántos comportamientos distintos viven fusionados en esa jerarquía?

Cuatro. Exactamente cuatro:

1. **Comisión** — qué porcentaje se aplica al monto
2. **Conversión de divisas** — si hay que convertir y cómo
3. **Fraud check** — si hay que validar contra un umbral
4. **Routing de red** — a qué gateway enviar el cargo

Separar esos cuatro comportamientos en colaboradores independientes y componerlos en un único `PaymentProcessor`:

```java
public class PaymentProcessor {

    private final CardNetworkGateway gateway;   // requerido
    private final FeeStrategy feeStrategy;      // opcional: FeeStrategy.none() si no hay
    private final CurrencyConverter converter;  // opcional: null si no hay conversión
    private final FraudGuard fraudGuard;        // opcional: null si no hay check
    private final AuditLogger auditLogger;      // opcional: null si no hay log

    public PaymentResult process(PaymentRequest request) {
        if (fraudGuard != null) {
            fraudGuard.check(request.getAccountId(), request.getAmount());
        }

        double amount = feeStrategy.apply(request.getAmount());

        if (converter != null) {
            amount = converter.toUsd(amount, request.getCurrency());
        }

        return gateway.charge(amount, request.getAccountId());
    }
}
```

Una sola clase. Sin herencia. Sin `if` sobre el tipo del procesador. Los comportamientos entran por constructor y se ejecutan si están presentes.

Las combinaciones viven en la factory:

```java
public class PaymentProcessorFactory {

    private static final double CARD_FEE_PERCENT     = 0.015;  // 1.5%
    private static final double CURRENCY_FEE_PERCENT = 0.02;   // 2%
    private static final double FRAUD_THRESHOLD      = 50_000.0;

    // Reemplaza la jerarquía de 4 niveles: VisaInternationalProcessor
    public static PaymentProcessor visaInternational(AuditLogger logger) {
        return new PaymentProcessor(
                CardNetworkGateway.visa(),
                FeeStrategy.percentage(CARD_FEE_PERCENT + CURRENCY_FEE_PERCENT),
                new CurrencyConverter(),
                new FraudGuard(FRAUD_THRESHOLD),
                logger);
    }

    // El requerimiento que rompió la jerarquía: cero clases nuevas
    public static PaymentProcessor visaInfiniteInternational(AuditLogger logger) {
        return new PaymentProcessor(
                CardNetworkGateway.visa(),
                FeeStrategy.percentage(CURRENCY_FEE_PERCENT),  // sin comisión de tarjeta
                new CurrencyConverter(),
                new FraudGuard(FRAUD_THRESHOLD),
                logger);
    }

    // AmEx: otra red, misma lógica — un method, no una subclase
    public static PaymentProcessor amexInternational(AuditLogger logger) {
        return new PaymentProcessor(
                CardNetworkGateway.amex(),
                FeeStrategy.percentage(CARD_FEE_PERCENT + CURRENCY_FEE_PERCENT),
                new CurrencyConverter(),
                new FraudGuard(FRAUD_THRESHOLD),
                logger);
    }

    // Domestic: sin conversión de divisas — null es explícito, no una bifurcación
    public static PaymentProcessor visaDomestic(AuditLogger logger) {
        return new PaymentProcessor(
                CardNetworkGateway.visa(),
                FeeStrategy.percentage(CARD_FEE_PERCENT),
                null,   // sin conversión
                new FraudGuard(FRAUD_THRESHOLD),
                logger);
    }
}
```

**El porqué del trade-off:** la jerarquía daba una ilusión de orden visual. La carpeta "explicaba" el dominio. Perdés eso. La factory no te dice "todos los procesadores internacionales comparten X" de manera estructural — te lo dice en el código de cada factory method, que es más redundante pero también más explícito.

Lo que ganás es la capacidad de agregar una combinación nueva sin tocar código existente. Visa Infinite sin comisión es un factory method nuevo. No toca `VisaInternationalProcessor` porque no existe. No toca `CardPaymentProcessor` porque no hay flags. No toca nada — solo ensambla colaboradores en un orden nuevo.

**Lo que se sacrifica:** la jerarquía de herencia hace visible "qué es subtype de qué". Con composición eso desaparece de la estructura y se convierte en semántica de la factory. Para equipos que navegan código por la jerarquía de clases, la transición requiere aprender a leer la factory como la fuente de verdad de las combinaciones.

**Lo que no se sacrifica:** cada colaborador es testeable de manera aislada. `CurrencyConverter` se testea con `new CurrencyConverter()`, sin necesitar instanciar la jerarquía completa. `FraudGuard` idem. En el diseño con herencia, testear la conversión de divisas requería instanciar `InternationalCardProcessor`, que es abstracta, lo que requería una subclase de test, que arrastra el contexto de `CardPaymentProcessor`. Con composición: una clase, un test, un `new`.

## La regla

| Métrica | Jerarquía | Composición |
|---|---|---|
| Clases para Visa + Mastercard internacionales | 5 (toda la jerarquía) | 1 `PaymentProcessor` + 1 factory |
| Agregar AmEx | 1 subclase Level-4 nueva | 0 clases — 1 factory method |
| Agregar Visa Infinite sin comisión | 1 subclase Level-5 o copy-paste | 0 clases — 1 factory method |
| Procesador sin fraud check | Romper jerarquía desde Level-2 | `null` en el parámetro `fraudGuard` |
| Testear `CurrencyConverter` aislado | Imposible sin subclase de test | `new CurrencyConverter()` |

La señal de alerta en código es una jerarquía de 3+ niveles donde agregar "casi lo mismo pero con una diferencia pequeña" obliga a un nodo nuevo o a un flag en un nodo base. Cuando aparece esa señal, la herencia está modelando combinaciones. Eso le corresponde a la composición.

La diferencia entre los dos principios es precisa: herencia es para variación de tipo ("A ES UN B y puede usarse en todos los contextos donde B aparece"). Composición es para variación de comportamiento ("A TIENE UN B que puede ser distinto según el contexto"). Cuando confundís los dos, el árbol crece hasta que nadie se anima a tocarlo.

El principio generalizable: antes de crear una subclase, preguntá si lo que necesitás es un nuevo tipo o una nueva combinación de comportamientos. Si es lo segundo, buscá el colaborador que falta y componelo. La factory es el lugar donde esa semántica vive explícita — no escondida en cuatro niveles de herencia que hay que leer de arriba a abajo para entender qué hace la hoja.

---

Día 21 de **#100ArchitectureDays**. El código completo — jerarquía de 4 niveles, diseño compuesto, y 19 tests — está en el repo.

⭐ Si el contenido te resulta útil, una estrella en [github.com/alafourcadev/100-architecture-days](https://github.com/alafourcadev/100-architecture-days) ayuda a que más gente lo encuentre.
