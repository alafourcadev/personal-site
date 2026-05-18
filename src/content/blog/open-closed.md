---
title: "Día 16: El if nuevo que rompió 5 features"
description: "Cada canal nuevo obligaba a abrir NotificationService y rezar. Sprint 4 rompió EMAIL. Sprint 7, lo mismo al agregar SLACK. Open/Closed Principle — extender sin tocar lo que ya anda. Día 16 de #100ArchitectureDays."
tags: ["Java", "Spring Boot", "Architecture", "100ArchitectureDays"]
date: 2026-05-18
readTime: "7 min read"
image: "/blog/open-closed.png"
day: 16
---

Sprint 4. El ticket decía "agregar canal PUSH a las notificaciones". El dev abrió `NotificationService`, bajó hasta el bloque de if/else, agregó un `else if (channel.equals("PUSH"))` y pusheó.

Los tests de EMAIL empezaron a fallar.

No había tocado la lógica de EMAIL. Pero mientras ajustaba la condición de validación de canal en la línea de arriba, la movió un par de pixels. Nada visible. Un cambio inocente que rompió algo que andaba.

Sprint 7: historia idéntica con SLACK. Sprint 11: lo mismo con WHATSAPP. El merge conflict de ese archivo iba en la tercera vez.

El problema no era el dev. Era el diseño que hizo necesario abrir esa clase cada vez.

## Por qué duele

El `NotificationService` original lucía así:

```java
@Service
public class NotificationService {

    public void send(NotificationRequest request) {
        String channel = request.getChannel();

        if (channel.equals("EMAIL")) {
            String body = "<html><body>" + request.getMessage() + "</body></html>";
            System.out.println("[EMAIL] To: " + request.getRecipient() + " | Body: " + body);

        } else if (channel.equals("SMS")) {
            String truncated = request.getMessage().length() > 160
                    ? request.getMessage().substring(0, 160)
                    : request.getMessage();
            System.out.println("[SMS] To: " + request.getRecipient() + " | Text: " + truncated);

        } else if (channel.equals("PUSH")) {
            // Agregado sprint 4. Rompió tests de EMAIL.
            System.out.println("[PUSH] Device: " + request.getRecipient()
                    + " | Payload: {\"body\":\"" + request.getMessage() + "\"}");

        } else if (channel.equals("SLACK")) {
            // Sprint 7. El if crece. Nadie recuerda por qué hay un trim() solo aquí.
            String slackMessage = request.getMessage().trim();
            System.out.println("[SLACK] Channel: " + request.getRecipient() + " | Text: " + slackMessage);

        } else if (channel.equals("WHATSAPP")) {
            // Sprint 11. Merge conflict otra vez.
            System.out.println("[WHATSAPP] Phone: " + request.getRecipient()
                    + " | Message: " + request.getMessage());

        } else {
            throw new IllegalArgumentException("Unknown notification channel: " + channel);
        }
    }
}
```

Cinco canales, cinco ramas de código viviendo en el mismo método. Cada vez que el negocio quería un canal nuevo, alguien tenía que abrir esta clase, operar en código que ya funcionaba, y esperar no romper nada en el proceso.

El costo real: cada feature nueva arrastra sesiones de testing manual para verificar que los canales previos siguen andando. Las regresiones son solo cuestión de tiempo porque el mecanismo que las produce está incorporado al diseño. Modificar código existente siempre tiene probabilidad de romper comportamiento existente — no por impericia, sino por la física del código acoplado.

## La trampa

El arreglo obvio cuando aparece un canal nuevo es justo lo que hicieron: agregar un `else if`. Es rápido, es localizado, parece inofensivo.

El problema es que eso escala linealmente con el número de canales. Cinco canales, cinco ramas. Diez canales, diez ramas. Y cada rama nueva es territorio que los canales anteriores no pedían transitar. El riesgo de regresión no disminuye con cada sprint — crece.

La alternativa inmediata que se considera después es extraer cada canal a su propio método privado dentro de la misma clase. `sendEmail()`, `sendSms()`, `sendPush()`. El despacho central sigue siendo el mismo switch statement, solo más organizado. La clase sigue creciendo con cada canal. Sigue siendo necesario abrirla para agregar comportamiento nuevo. El problema de raíz no se mueve.

## La decisión y su porqué

El rediseño parte de una pregunta: ¿por qué `NotificationService` necesita saber los detalles de cada canal?

No los necesita. Su trabajo es despachar. Decidir a quién delegar. El cómo mandar un email es responsabilidad de quien sabe de emails, no de quien coordina el despacho.

Eso lleva a una interfaz:

```java
// Punto de extensión — nadie toca esto para agregar un canal
public interface NotificationSender {
    boolean supports(String channel);
    void send(NotificationRequest request);
}
```

Y `NotificationService` pasa a trabajar con la abstracción, no con los canales concretos:

```java
@Service
public class NotificationService {

    private final List<NotificationSender> senders;

    public NotificationService(List<NotificationSender> senders) {
        this.senders = senders;
    }

    public void send(NotificationRequest request) {
        senders.stream()
                .filter(sender -> sender.supports(request.getChannel()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Unknown notification channel: " + request.getChannel()))
                .send(request);
    }
}
```

No hay un solo `if` sobre el canal. Spring inyecta todos los `@Component` que implementen `NotificationSender` — `NotificationService` no los conoce por nombre, solo los usa.

Cada canal vive en su propia clase:

```java
@Component
public class EmailNotificationSender implements NotificationSender {

    @Override
    public boolean supports(String channel) {
        return "EMAIL".equals(channel);
    }

    @Override
    public void send(NotificationRequest request) {
        String body = "<html><body>" + request.getMessage() + "</body></html>";
        System.out.println("[EMAIL] To: " + request.getRecipient()
                + " | Subject: Notification | Body: " + body);
    }
}
```

Agregar WhatsApp en el sprint 11 se reduce a crear `WhatsappNotificationSender implements NotificationSender`. `NotificationService` no se toca. `EmailNotificationSender` no se toca. `SmsNotificationSender` no se toca. Sus tests no se tocan.

**El trade-off es real**: el diseño anterior tenía una clase y un archivo. El nuevo tiene una interfaz más una clase por canal. Más archivos, más estructura inicial que entender. Si hay dos canales y el producto ya está estable, la complejidad extra puede no valer. El diseño con interfaz paga su costo cuando el número de variantes crece y cuando esas variantes las agregan personas distintas en momentos distintos. Eso es exactamente lo que pasaba con los sprints de canales nuevos — y es donde el `if` creciente tiene el mayor potencial de daño colateral.

Lo que se sacrifica a cambio de la extensibilidad: mayor fricción para entender el flow completo (ahora requiere conocer que Spring inyecta la lista), y más archivos que mantener. Lo que se gana: tocar `EmailNotificationSender` no puede romper `SmsNotificationSender` — son clases independientes sin código compartido entre ellas.

## La regla

Este es el Open/Closed Principle: una clase debe estar abierta para extensión y cerrada para modificación.

No significa "nunca editá ese archivo". Significa que agregar comportamiento nuevo no debería requerir modificar comportamiento existente. Si cada feature nueva te obliga a abrir la misma clase, esa clase es un cuello de botella de cambio — y el riesgo de regresión está estructuralmente incorporado al proceso.

La señal de alerta en código es un método que crece con `else if` por tipo: por canal, por formato, por proveedor, por rol. Cuando el método crece con cada caso nuevo, el diseño no está cerrado. Está abierto en el lugar equivocado.

El patrón que resuelve esto es consistente: una interfaz que define el contrato, implementaciones independientes por variante, y un coordinador que trabaja con la abstracción. Spring lo facilita con inyección de listas, pero el mecanismo funciona igual con un mapa, un factory, o un registro explícito. El principio es el mismo.

La pregunta que hay que hacerse antes de agregar el `else if` siguiente:

**¿Necesito modificar esta clase para agregar este comportamiento, o puedo extenderla sin tocarla?**

Si la respuesta es "tengo que modificarla", ese es el momento de rediseñar — no después del sprint 7.

---

Día 16 de **#100ArchitectureDays**. El código completo antes/después está en el repo con los tests incluidos.

⭐ Si el contenido te resulta útil, una estrella en [github.com/alafourca/100-architecture-days](https://github.com/alafourca/100-architecture-days) ayuda a que más gente lo encuentre.
