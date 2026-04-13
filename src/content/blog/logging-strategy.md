---
title: "Día 11: System.out.println en producción — la confesión que nadie hace"
description: "Tus logs son ruido puro. Sin timestamp, sin nivel, sin contexto. A las 3AM con producción caído, ese println no te va a salvar. Día 11 de #100ArchitectureDays."
tags: ["Java", "Spring Boot", "Architecture", "100ArchitectureDays"]
date: 2026-04-13
readTime: "8 min read"
image: "/blog/logging-strategy.webp"
day: 11
---

Son las 3 de la mañana. Producción está caído. Abres los logs. 50.000 líneas de `System.out.println` que dicen cosas como "entró al método", "valor: " + algo, "pasó por acá". Ninguna tiene timestamp. Ninguna tiene nivel de severidad. Ninguna te dice qué request generó ese log.

Bienvenido a tu propia pesadilla. La diseñaste tú mismo.

Y antes de que digas "yo no hago eso" — haz un `grep` rápido de `System.out.println` en tu proyecto. O de `console.log` si estás en Node. O de `print()` sin `logging` si estás en Python. El resultado te va a sorprender.

## Esto no es solo de Java

El anti-pattern es universal. Cada lenguaje tiene su versión:

- **Java**: `System.out.println` en vez de SLF4J/Logback
- **JavaScript/Node**: `console.log` en vez de Winston/Pino
- **Python**: `print()` en vez del módulo `logging`
- **Go**: `fmt.Println` en vez de `log/slog` o Zap
- **Ruby**: `puts` en vez de `Logger`
- **.NET**: `Console.WriteLine` en vez de `ILogger`

El problema es el mismo en todos los casos: estás imprimiendo texto plano a stdout sin estructura, sin niveles, sin metadata. Parece que estás logueando. Pero cuando lo necesitas de verdad, descubres que lo que tienes es ruido.

## Por qué System.out.println destruye tu producción

No es solo que no tenga metadata. Es que **afecta el rendimiento**:

1. **Es sincrónico** — cada println bloquea el thread hasta que el output se flushea. Con 200 threads concurrentes, todos escribiendo a stdout, creas contención en un recurso compartido.
2. **No tiene niveles** — no puedes filtrar. ¿Quieres ver solo errores? Imposible. Es todo o nada.
3. **No tiene contexto** — cuando 100 requests concurrentes imprimen "Procesando pago...", no sabes cuál es cuál.
4. **No rota** — stdout no tiene rotación de archivos. Si redireccionas a un archivo, crece hasta llenar el disco.

## El ANTES: el caos

```java
@Service
public class PagoService {

    public PagoResponse procesarPago(PagoRequest request) {
        System.out.println("Procesando pago...");
        System.out.println("Monto: " + request.getMonto());
        System.out.println("Cliente: " + request.getClienteId());

        try {
            var resultado = gateway.cobrar(request);
            System.out.println("Pago OK: " + resultado.getId());
            return resultado;
        } catch (Exception e) {
            System.out.println("Error en pago: " + e.getMessage());
            throw e;
        }
    }
}
```

En producción esto se ve así:

```
Procesando pago...
Monto: 15000
Procesando pago...
Cliente: 4821
Monto: 8700
Error en pago: timeout
Cliente: 9102
Pago OK: TXN-44291
Procesando pago...
```

¿Qué pago falló? ¿De qué cliente? ¿A qué hora? No tienes idea. Los logs de distintos requests se mezclan. Es ruido puro.

## El DESPUÉS: logging con sentido

```java
@Service
public class PagoService {

    private static final Logger log = LoggerFactory.getLogger(PagoService.class);

    public PagoResponse procesarPago(PagoRequest request) {
        log.info("Procesando pago. clienteId={}, monto={}",
                 request.getClienteId(), request.getMonto());

        try {
            var resultado = gateway.cobrar(request);
            log.info("Pago exitoso. txnId={}, clienteId={}",
                     resultado.getId(), request.getClienteId());
            return resultado;
        } catch (Exception e) {
            log.error("Fallo al procesar pago. clienteId={}, monto={}",
                      request.getClienteId(), request.getMonto(), e);
            throw e;
        }
    }
}
```

Ahora los logs se ven así:

```
2026-04-13 03:14:22.841 INFO  [http-nio-8080-exec-7] c.a.s.PagoService : Procesando pago. clienteId=4821, monto=15000
2026-04-13 03:14:23.102 ERROR [http-nio-8080-exec-3] c.a.s.PagoService : Fallo al procesar pago. clienteId=9102, monto=8700
java.net.SocketTimeoutException: timeout
    at com.app.gateway.GatewayClient.cobrar(GatewayClient.java:45)
```

Cada línea tiene **timestamp, nivel, thread, clase y datos estructurados**. En 2 segundos sabes qué falló, cuándo y para quién.

## Los niveles no son decoración

Cada framework de logging tiene los mismos niveles. La tabla aplica a cualquier lenguaje:

| Nivel | Cuándo usarlo | Ejemplo |
|---|---|---|
| **ERROR** | Algo falló y necesita atención | Error al procesar pago, conexión perdida |
| **WARN** | Algo raro pero la app sigue | Retry #3, cache miss inesperado |
| **INFO** | Eventos de negocio relevantes | Pago procesado, usuario creado |
| **DEBUG** | Detalle técnico para troubleshooting | Query ejecutada, payload recibido |
| **TRACE** | Todo lo demás (casi nunca en prod) | Entrada/salida de cada método |

La regla: **en producción corres en INFO**. Si hay un problema, subes un paquete específico a DEBUG **sin reiniciar**. En Spring Boot, Actuator te permite cambiar niveles de log en caliente:

```bash
curl -X POST localhost:8080/actuator/loggers/com.tuapp.gateway \
  -H 'Content-Type: application/json' \
  -d '{"configuredLevel": "DEBUG"}'
```

Sin redeploy. Sin restart. Cambias el nivel, miras los logs, resuelves el problema, vuelves a INFO.

En Node con Winston es similar: cambias el `level` del transport en runtime. En Python con `logging.getLogger().setLevel()`. El concepto es el mismo en todos lados.

## Structured logging: el salto de calidad

Si tus logs van a un ELK Stack, Datadog, CloudWatch o cualquier herramienta de observabilidad, el formato texto plano es un problema. Lo que necesitas es JSON:

```json
{
  "timestamp": "2026-04-13T03:14:23.102Z",
  "level": "ERROR",
  "logger": "com.tuapp.service.PagoService",
  "message": "Fallo al procesar pago",
  "clienteId": 9102,
  "monto": 8700,
  "stack_trace": "java.net.SocketTimeoutException..."
}
```

Buscable. Filtrable. Alertable. Puedes hacer queries como "dame todos los ERROR del PagoService en la última hora donde monto > 10000". Intenta hacer eso con `System.out.println`.

En Spring Boot se configura con Logstash encoder. En Node con Pino (que ya sale en JSON por default). En Python con `python-json-logger`. En Go con `slog` (que viene integrado desde Go 1.21).

## Lo que NO deberías loguear

Antes de loguear todo, un segundo:

- **Passwords, tokens, API keys.** Jamás. Ni en DEBUG. `log.debug("Token: {}", token)` es un incidente de seguridad esperando a pasar.
- **Datos personales sensibles.** DNI, tarjetas de crédito, datos médicos. Si tu log tiene PII, tienes un problema de compliance.
- **El request body completo.** Un JSON de 2MB en cada log llena tu disco en horas.
- **Datos que no ayudan a diagnosticar nada.** "Entró al método" no es información. "Procesando pedido 4821 para cliente 102" sí lo es.

## El error de fondo

`System.out.println` te da una falsa sensación de visibilidad. Parece que estás logueando. Parece que tienes información. Pero cuando la necesitas de verdad, a las 3AM con producción caído, descubres que lo que tienes es ruido.

Logging profesional no es difícil. Todos los lenguajes y frameworks modernos ya tienen las herramientas listas. Solo tienes que dejar de usar `print` y empezar a pensar qué información necesitarías para diagnosticar un problema que todavía no pasó.

Haz un `grep` de `System.out.println` en tu proyecto. Si aparece más de cero veces en código de producción, tienes tarea.

## Esto es el Día 11

Este artículo es parte de **#100ArchitectureDays** — una serie de problemas reales de arquitectura con soluciones reales.

Sigue la saga completa en **#100ArchitectureDays**.

Todo el código está en [GitHub](https://github.com/alafourcadev/100-architecture-days) — con el BEFORE/AFTER para que veas la diferencia en la consola en tiempo real. Si te está sirviendo, déjame una estrella — es gratis y ayuda a que más gente lo encuentre.
