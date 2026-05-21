---
title: "Día 18: Cambiar de proveedor sin tocar el core"
description: "ReportService tenía el proveedor hardcodeado. Cambiar a SMS exigía abrir el core. DIP: depende de la abstracción, no del proveedor. #100ArchitectureDays."
tags: ["Java", "Spring Boot", "Architecture", "100ArchitectureDays"]
date: 2026-05-21
readTime: "7 min read"
image: "/blog/dependency-inversion.png"
day: 18
---

Llegué a un equipo a mediados de un sprint. El negocio acababa de decidir migrar de email a SMS para las notificaciones de reportes. El dev me explicó el plan: "es un cambio chico, abrimos `ReportService`, sacamos `EmailNotificationService`, ponemos `SmsNotificationService`, y listo".

Abrí la clase.

```java
public class ReportService {

    private final EmailNotificationService emailNotificationService;

    public ReportService() {
        this.emailNotificationService = new EmailNotificationService();
    }

    public void generateAndNotify(String reportName, String recipient) {
        String result = generateReport(reportName);
        emailNotificationService.sendEmail(recipient, "Report ready: " + reportName, result);
    }
}
```

"Un cambio chico" era abrir el core, borrar el campo, cambiar el constructor, reescribir la llamada con la firma nueva, y asegurarse de que todos los tests de negocio que pasaban por ese constructor no se rompieran. Sprint 8 traería push notifications. Sprint 12, Slack. El mismo circo, tres veces más.

El problema no era el dev. Era que el diseño hacía imposible cambiar de proveedor sin tocar lo que no debería cambiar.

## Por qué duele

`ReportService` tiene dos responsabilidades que no deberían estar juntas: generar el reporte y saber cómo notificar. No solo sabe que hay un servicio de email, sino que lo crea con `new`. Eso significa que controla el ciclo de vida de su dependencia y conoce su interfaz concreta (`sendEmail`, con tres parámetros específicos).

El costo real se siente cuando el negocio cambia de proveedor, y siempre lo hace. Cambiar de email a SMS implica:

1. Eliminar el campo `emailNotificationService`
2. Agregar `SmsNotificationService` como campo nuevo
3. Cambiar el constructor para crear la instancia nueva
4. Reescribir la llamada porque `sendEmail(recipient, subject, body)` no tiene la misma firma que `sendSms(...)`
5. Verificar que todos los tests de negocio que pasan por `ReportService` siguen andando después de la cirugía

El módulo de alto nivel (la lógica de negocio) depende del módulo de bajo nivel (el proveedor de infraestructura). Cada cambio de proveedor arrastra consigo el core. No porque el negocio cambie, sino porque el diseño ata ambas cosas con `new`.

## La trampa

La primera reacción suele ser agregar un parámetro al constructor para elegir el proveedor:

```java
public ReportService(String notificationType) {
    if ("SMS".equals(notificationType)) {
        this.notifier = new SmsNotificationService();
    } else {
        this.notifier = new EmailNotificationService();
    }
}
```

Parece más flexible. El core ya no instancia directo, delega al if. Pero el core sigue conociendo todos los proveedores concretos. Agregar push en sprint 8 requiere abrir `ReportService` otra vez y agregar el `else if`. El core sigue siendo el catálogo de proveedores disponibles. La clase no mejoró; solo se volvió más larga.

La variante con enum tiene el mismo problema: el core enumera los proveedores que existen, y cada proveedor nuevo requiere modificarlo.

## La decisión y su porqué

El rediseño parte de una pregunta: ¿qué necesita saber `ReportService` sobre la notificación?

Solo esto: que puede notificar a alguien con un asunto y un mensaje. No le importa si es email, SMS, push, o palomas mensajeras. Eso va en una interfaz:

```java
public interface NotificationPort {
    void notify(String recipient, String subject, String message);
}
```

`ReportService` recibe la abstracción por constructor:

```java
public class ReportService {

    private final NotificationPort notificationPort;

    public ReportService(NotificationPort notificationPort) {
        this.notificationPort = notificationPort;
    }

    public void generateAndNotify(String reportName, String recipient) {
        String result = generateReport(reportName);
        notificationPort.notify(recipient, "Report ready: " + reportName, result);
    }
}
```

No hay un `new`. No hay un `if`. No hay ninguna referencia a email ni SMS. `ReportService` no sabe qué hay del otro lado del puerto, y no necesita saberlo.

Los proveedores concretos viven en clases independientes:

```java
@Component
public class EmailNotificationAdapter implements NotificationPort {
    @Override
    public void notify(String recipient, String subject, String message) {
        System.out.printf("[EMAIL] To: %s | Subject: %s | Body: %s%n",
                recipient, subject, message);
    }
}

public class SmsNotificationAdapter implements NotificationPort {
    @Override
    public void notify(String recipient, String subject, String message) {
        System.out.printf("[SMS] To: %s | %s: %s%n", recipient, subject, message);
    }
}
```

Migrar de email a SMS en sprint 3 es activar `SmsNotificationAdapter` en el contexto de Spring. `ReportService` no se toca. Sus tests no se rompen. El core no sabe que hubo un cambio porque el core nunca supo qué había del otro lado.

**El PORQUÉ del principio**: módulos de alto nivel no deben depender de módulos de bajo nivel. Ambos deben depender de abstracciones. El dominio define el contrato (`NotificationPort`), la infraestructura lo implementa desde afuera. Nunca al revés.

El nombre `Port` no es casualidad. DIP es el fundamento del que emerge la arquitectura hexagonal: el dominio define puertos, la infraestructura provee adaptadores. Cuando esa separación existe, cambiar de proveedor es añadir un adaptador. El core no se entera.

**El trade-off es real**: hay más archivos que entender. La jerarquía creció: antes había una clase, ahora hay una interfaz más dos adaptadores. Si el proveedor no va a cambiar nunca y el proyecto es pequeño, esa complejidad puede no valer. El diseño con puerto paga su costo cuando el número de proveedores crece o cuando distintas personas, en distintos momentos, necesitan extender sin coordinarse con quien escribió el core. Que era exactamente el escenario de esos sprints.

Lo que se sacrifica: mayor fricción para seguir el flow (ahora hay que saber qué implementación inyecta Spring). Lo que se gana: tocar `EmailNotificationAdapter` no puede afectar a `SmsNotificationAdapter`. Son clases independientes. Y el core queda cerrado a modificación cuando el negocio cambia de proveedor.

## La regla

Antes de escribir `new ConcreteService()` dentro de un servicio de negocio, la pregunta es una sola: ¿puede este módulo necesitar una implementación distinta en algún contexto? En tests, en producción con proveedor B, en una integración nueva.

Si la respuesta es sí, o siquiera "tal vez", el módulo de negocio no debería instanciar la clase concreta. Debería recibir la abstracción y dejar que quien configure el contexto decida la implementación.

Cada `new ConcreteService()` dentro del core es una cadena que ata el módulo de negocio a ese proveedor. Cuando el negocio cambia de proveedor, y siempre lo hace, la cadena te arrastra a abrir código que no debería cambiar.

La señal de alerta es precisa: si para cambiar el proveedor tenés que abrir la clase de negocio, el principio está violado. El core no debería enterarse de eso.

---

Día 18 de **#100ArchitectureDays**. El código completo antes/después con los tests está en el repo.

⭐ Si el contenido te resulta útil, una estrella en [github.com/alafourcadev/100-architecture-days](https://github.com/alafourcadev/100-architecture-days) ayuda a que más gente lo encuentre.
