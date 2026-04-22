---
title: "Día 13: Tu clase tiene 50 métodos. Hace de todo. No hace nada bien."
description: "Ese OrderService, UserManager o PedidoController que todos tocan y nadie entiende es un God Object — y te está costando plata real. Cómo identificarlo y desarmarlo con SRP. Día 13 de #100ArchitectureDays."
tags: ["Java", "Spring Boot", "Architecture", "100ArchitectureDays"]
date: 2026-04-21
readTime: "7 min read"
image: "/blog/god-object-srp.webp"
day: 13
---

Abre tu proyecto. Busca la clase más grande. La que tiene más métodos. La que todos tocan pero nadie entiende del todo. La que cuando entra alguien nuevo al equipo, le dices "no te preocupes por esa, ya la vas a ir entendiendo".

Esa clase tiene nombre técnico. Se llama **God Object**. Y probablemente le está costando a tu empresa más plata que cualquier bug que hayas corregido en el último año.

Lo mejor (y lo peor) es que no importa el lenguaje, el framework, ni el tamaño del equipo. Esta clase existe en tu proyecto. Solo cambia el nombre.

## Esto no es solo de Spring

El anti-pattern es universal. Solo cambia el nombre del archivo:

- **Java / Spring Boot**: `OrderService`, `UserManager`, `PedidoController`
- **.NET**: `OrderController` con 40 endpoints y 12 servicios inyectados
- **Node / NestJS**: `user.service.ts` que hace auth, emails, pagos y logging
- **Python / Django**: `views.py` con 2000 líneas y toda la lógica de negocio
- **Ruby on Rails**: el modelo `User` con 80 métodos y 15 callbacks
- **PHP / Laravel**: el `OrderService` que también es `PaymentService` y `MailService`

El problema es el mismo: una clase que empezó razonable y se fue inflando con cada feature nueva, porque "total, ya está inyectado acá, le agregamos este método y listo".

## Cómo sabes que lo tienes

Tu clase es un God Object si cumple al menos tres de estas:

1. Tiene más de 5 dependencias en el constructor (o imports/inyecciones).
2. Mezcla responsabilidades que no se hablan entre sí: validación, emails, PDFs, métricas, integraciones.
3. Cada merge request en esa clase genera conflictos con otros devs.
4. Para testear un método hay que mockear media aplicación.
5. Nadie en el equipo la entiende completa. Todos conocen "su pedazo".

Si las cumples todas, lo siento. Lo tuyo no es una clase, es una pequeña empresa.

## El ejemplo clásico

Este es el tipo de clase del que hablamos. Java con Spring Boot, pero el patrón se ve igual en cualquier stack:

```java
@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final EmailClient emailClient;
    private final PdfGenerator pdfGenerator;
    private final MetricsService metricsService;
    private final WarehouseClient warehouseClient;
    private final DiscountEngine discountEngine;
    private final PaymentGateway paymentGateway;
    private final NotificationService notificationService;
    private final AuditLogger auditLogger;

    // Constructor con 11 dependencias...

    public Order createOrder(CreateOrderRequest request) { /* 80 líneas */ }
    public Order updateOrder(Long id, UpdateOrderRequest request) { /* 60 líneas */ }
    public void cancelOrder(Long id) { /* 45 líneas */ }
    public void processPayment(Long orderId) { /* 50 líneas */ }
    public void applyDiscount(Long orderId, String code) { /* 30 líneas */ }
    public byte[] generateInvoice(Long orderId) { /* 40 líneas */ }
    public void sendConfirmationEmail(Long orderId) { /* 25 líneas */ }
    public void notifyWarehouse(Long orderId) { /* 35 líneas */ }
    public void updateMetrics(Long orderId) { /* 20 líneas */ }
    public List<Order> findByUser(Long userId) { /* 15 líneas */ }
    public OrderReport generateReport(DateRange range) { /* 55 líneas */ }
    // ... 40 métodos más
}
```

Once dependencias, 50+ métodos, un constructor que no entra en la pantalla. Cada cambio es un campo minado.

## Por qué duele en el día a día

El problema no es estético, es operacional. Lo sientes cada sprint:

- **Cada cambio es riesgoso.** Tocas el cálculo de descuentos y, no se sabe cómo, rompes el envío de emails. Cuando todo está acoplado, un cambio en una línea tiene efectos en lugares inesperados.
- **Los tests son un infierno.** Para probar un método simple tienes que mockear las 11 dependencias, aunque el método solo use 2.
- **Los merge conflicts son el pan de cada semana.** Si tres devs tocan esta clase en paralelo, los conflictos están garantizados.
- **Nadie se anima a refactorizarla.** Es tan grande y tan usada que el primero que la toque en serio va a romper media aplicación.

Al final, cada feature nueva tarda el doble de lo que debería. Y eso sí se traduce en plata.

## La solución: Single Responsibility Principle

SRP no dice "una clase hace una cosa". Dice algo más preciso, y más útil: **una clase debe tener una única razón para cambiar**.

Lee esa definición de nuevo. "Razón para cambiar" es el criterio. Si tu clase cambia cuando cambia el pricing, cuando cambia el formato del email, y cuando cambia la integración con el warehouse, esas son tres razones para cambiar. Tres clases distintas.

Vamos al refactor. Primero, un `OrderService` con una sola responsabilidad: gestionar el ciclo de vida de las órdenes.

```java
@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderValidator orderValidator;
    private final OrderEventPublisher eventPublisher;

    public OrderService(OrderRepository orderRepository,
                        OrderValidator orderValidator,
                        OrderEventPublisher eventPublisher) {
        this.orderRepository = orderRepository;
        this.orderValidator = orderValidator;
        this.eventPublisher = eventPublisher;
    }

    public Order createOrder(CreateOrderRequest request) {
        orderValidator.validate(request);
        Order order = Order.from(request);
        Order saved = orderRepository.save(order);
        eventPublisher.publish(new OrderCreatedEvent(saved));
        return saved;
    }
}
```

De 11 dependencias a 3. Un método que se lee en 10 segundos. Un propósito claro.

El resto de funcionalidades va a servicios especializados, cada uno con su razón propia para existir:

```java
@Service
public class OrderPricingService {
    private final DiscountEngine discountEngine;

    public Money calculateTotal(Order order, String discountCode) {
        Money subtotal = order.calculateSubtotal();
        Discount discount = discountEngine.resolve(discountCode);
        return discount.applyTo(subtotal);
    }
}

@Service
public class OrderNotificationService {
    private final EmailClient emailClient;
    private final PdfGenerator pdfGenerator;

    @EventListener
    public void onOrderCreated(OrderCreatedEvent event) {
        byte[] invoice = pdfGenerator.generate(event.getOrder());
        emailClient.sendOrderConfirmation(event.getOrder(), invoice);
    }
}

@Service
public class OrderFulfillmentService {
    private final WarehouseClient warehouseClient;

    @EventListener
    public void onOrderCreated(OrderCreatedEvent event) {
        warehouseClient.reserve(event.getOrder().getItems());
    }
}
```

Cada uno tiene una única razón para cambiar:

- `OrderPricingService` cambia cuando cambian las reglas de pricing.
- `OrderNotificationService` cambia cuando cambia el template del email o el PDF.
- `OrderFulfillmentService` cambia cuando cambia la integración con el warehouse.

## El detalle que hace que funcione: eventos

Fíjate que a los servicios secundarios no los llama `OrderService`. Se suscriben a un evento (`OrderCreatedEvent`) que `OrderService` publica.

Esto cambia tres cosas:

1. `OrderService` no conoce a `OrderNotificationService` ni a `OrderFulfillmentService`. No los importa, no los inyecta, no los llama.
2. Si mañana agregas un `OrderAnalyticsService` que escuche el mismo evento, no tocas `OrderService`. Ni una línea.
3. Los tests de `OrderService` solo verifican que el evento se publica, no todo lo que pasa después.

Si tu lenguaje/framework no tiene eventos nativos (Spring `@EventListener`, NestJS `EventEmitter`, Django signals, Rails callbacks), funciona igual con un bus de eventos simple. El patrón es el mismo.

## La regla del constructor

Si quieres una heurística rápida que puedas aplicar mañana en tu proyecto:

**Cuenta las dependencias del constructor de cada clase. Si tiene más de 4 o 5, es sospechoso.**

No es un número mágico, pero es un olor fuerte. Piénsalo así: dos clases del mismo proyecto, una con 3 dependencias y otra con 11 — ¿cuál te da más miedo tocar?

Otra señal útil: si puedes agrupar los métodos de una clase en "bloques" que no se comunican entre sí, cada bloque probablemente debería ser su propia clase.

## El error al aplicar SRP mal

El error más común es entender SRP como "un método por clase" y terminar con 200 archivos que no significan nada. Eso no es SRP, es fragmentación sin criterio.

SRP agrupa por **cohesión**: los métodos que trabajan con los mismos datos y cambian por los mismos motivos van juntos. Los que no, se separan.

La regla no es "una clase por método". Es "una clase por responsabilidad".

## El resultado

```
ANTES:   OrderService (50 métodos, 11 dependencias)

DESPUÉS: OrderService             (ciclo de vida)
         OrderPricingService      (precios y descuentos)
         OrderNotificationService (emails y PDFs)
         OrderFulfillmentService  (warehouse)
         OrderReportingService    (reportes y métricas)
```

Cinco clases pequeñas que puedes testear, entender y modificar de forma independiente. Ninguna con más de 3 dependencias. Ninguna con más de 5 métodos.

## La pregunta que tienes que hacerte

Tu God Object no se creó un día. Se fue armando commit a commit, con la lógica razonable de "ya está acá, le agrego este método y listo". Nadie diseña un monstruo de 50 métodos a propósito.

La próxima vez que vayas a agregar un método a una clase existente, hazte esta pregunta:

**¿Esta clase cambiaría por el mismo motivo por el que estoy agregando este método?**

Si la respuesta es sí, adelante. Si es no, ese método tiene otro hogar.

Con eso, ya tienes la mitad del SRP aplicado en la práctica.

Día 13 de **#100ArchitectureDays**.
