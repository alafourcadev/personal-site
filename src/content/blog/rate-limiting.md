---
title: "Día 12: 5.000 personas hicieron click al mismo tiempo. Tu servidor pidió perdón."
description: "Tu API no tiene límites. Cualquiera puede hacer las requests que quiera, a la velocidad que quiera. Rate limiting y el algoritmo Token Bucket. Día 12 de #100ArchitectureDays."
tags: ["Java", "Spring Boot", "Architecture", "100ArchitectureDays"]
date: 2026-04-14
readTime: "8 min read"
image: "/blog/rate-limiting.webp"
day: 12
---

Tu tienda online sale a internet. Llevas meses preparándote. La campaña de marketing hizo su trabajo. 5.000 personas están esperando con el dedo en el botón de "Comprar". La cuenta regresiva llega a cero. Todos hacen click al mismo tiempo.

Tu servidor tiene 20 threads. Se saturan en menos de un segundo. Los otros 4.980 requests se encolan. Empiezan los timeouts. El login deja de funcionar. La página de inicio no carga. El botón de "Comprar" gira y gira. La gente empieza a refrescar. Cada refresh son más requests. Más cola. Más timeouts. El ciclo se retroalimenta.

En 3 minutos, lo que iba a ser tu mejor día se convirtió en tu peor pesadilla.

## No es un problema de capacidad. Es un problema de control.

La reacción instintiva es "necesitamos más servidores". Y sí, tal vez. Pero el problema real es otro: **tu API no tiene límites**. Cualquier cliente puede hacer las requests que quiera, a la velocidad que quiera. No hay semáforo. No hay velocidad máxima. No hay nada que diga "para un poco".

Esto no es exclusivo del lanzamiento de una tienda. Es el mismo problema cuando:

- Un bot descubre tu API y la empieza a scrapear
- Un frontend con un bug hace polling cada 100ms en vez de cada 10 segundos
- Un partner de integración reintenta sin backoff exponencial
- Un usuario frustrado martillea F5 porque la página "no carga"

Sin rate limiting, tu API es un buffet libre donde un solo comensal se puede comer toda la comida y dejar a los demás sin nada.

## Rate limiting: el concepto

La idea es simple: **poner un límite a cuántas requests puede hacer cada cliente en un período de tiempo**. Si lo supera, la API le responde con un error claro (HTTP 429 — Too Many Requests) en vez de intentar procesar todo y colapsar.

El algoritmo más usado se llama **Token Bucket** y funciona así:

1. Cada cliente tiene un "balde" con N tokens
2. Cada request consume 1 token
3. Los tokens se regeneran a velocidad constante (por ejemplo, 50 por minuto)
4. Si el balde está vacío, la request se rechaza con 429

Es elegante porque permite ráfagas cortas (si el balde está lleno, puedes hacer varias requests rápidas) pero limita el tráfico sostenido.

Este algoritmo lo usan:

- **AWS API Gateway** — Token Bucket con burst
- **Stripe API** — 100 requests por segundo por defecto
- **GitHub API** — 5.000 requests por hora para autenticados
- **Twitter/X API** — Rate limits por endpoint y por ventana de tiempo
- **Cloudflare** — Token Bucket configurable por zona
- **nginx** — `limit_req` con leaky bucket (variante similar)

No es un concepto oscuro ni experimental. Es **infraestructura estándar** que cualquier API pública del mundo implementa. La pregunta no es "¿necesito rate limiting?" — es "¿por qué todavía no lo tengo?"

## Implementación: cómo se ve

En cualquier lenguaje, rate limiting es un filtro que se ejecuta ANTES de tu lógica de negocio. Si el cliente ya superó su límite, ni siquiera llegas al controller.

La implementación del Token Bucket en Java es sorprendentemente simple:

```java
public class TokenBucket {

    private final long capacity;
    private final double refillRatePerMs;
    private double tokens;
    private long lastRefillTimestamp;

    public TokenBucket(long capacity, long refillPerMinute) {
        this.capacity = capacity;
        this.refillRatePerMs = refillPerMinute / 60000.0;
        this.tokens = capacity;
        this.lastRefillTimestamp = System.currentTimeMillis();
    }

    public synchronized boolean tryConsume() {
        refill();
        if (tokens >= 1) {
            tokens--;
            return true;
        }
        return false;
    }

    private void refill() {
        long now = System.currentTimeMillis();
        double newTokens = (now - lastRefillTimestamp) * refillRatePerMs;
        tokens = Math.min(capacity, tokens + newTokens);
        lastRefillTimestamp = now;
    }
}
```

En Python con Flask sería un decorator. En Node con Express un middleware. En Go un middleware con `golang.org/x/time/rate`. El patrón es idéntico: interceptar, verificar, dejar pasar o rechazar.

## Aplicándolo al escenario de la tienda

Volvamos al lanzamiento. Lo que necesitas es:

```java
@Component
public class RateLimitFilter implements Filter {

    private final Map<String, TokenBucket> buckets = new ConcurrentHashMap<>();

    @Override
    public void doFilter(ServletRequest req, ServletResponse res,
                         FilterChain chain) throws IOException, ServletException {

        HttpServletRequest request = (HttpServletRequest) req;
        HttpServletResponse response = (HttpServletResponse) res;

        String clientIp = request.getRemoteAddr();
        String path = request.getRequestURI();

        TokenBucket bucket = buckets.computeIfAbsent(
            clientIp + ":" + path, k -> crearBucket(path));

        if (bucket.tryConsume()) {
            response.setHeader("X-Rate-Limit-Remaining",
                String.valueOf(bucket.getAvailableTokens()));
            chain.doFilter(req, res);
        } else {
            response.setStatus(429);
            response.setHeader("Retry-After", "10");
            response.getWriter().write("Too Many Requests");
        }
    }
}
```

Ahora cada IP tiene un límite. Los primeros 10 "Comprar" pasan. Del 11 en adelante reciben un 429 limpio en milisegundos, sin ocupar threads, sin tocar la base de datos, sin degradar el servicio para los demás.

## Límites diferentes para rutas diferentes

No todos los endpoints son iguales. El endpoint de compra necesita protección fuerte (stock limitado, procesamiento pesado). El listado de productos puede ser más generoso:

| Endpoint | Límite | Razón |
|---|---|---|
| `/comprar` | 10/min | Proteger stock, procesamiento de pago |
| `/productos` | 60/min | Lectura, ligero |
| `/login` | 5/min | Prevención de fuerza bruta |
| `/imágenes` | 100/min | Assets estáticos (mejor en CDN) |

## Los headers que el cliente necesita

Cuando rechazas una request con 429, sé un buen ciudadano HTTP. Dile al cliente cuándo puede reintentar:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 10
X-Rate-Limit-Limit: 50
X-Rate-Limit-Remaining: 0
```

El frontend (o el bot, o el partner de integración) puede leer estos headers y adaptarse: mostrar un mensaje al usuario, implementar backoff, o simplemente dejar de disparar requests.

## Los números del escenario de la tienda

| | Sin rate limit | Con rate limit |
|---|---|---|
| Requests en ráfaga | 5.000 simultáneas | 10/min por IP |
| Latencia p95 (otros endpoints) | 2.800ms | 180ms |
| CPU promedio en pico | 95% | 45% |
| Disponibilidad bajo carga | 78% | 99.5% |

El rate limiting no hizo que "Comprar" fuera más rápido. Hizo que **todo lo demás siguiera funcionando**. El login, la página de inicio, el carrito — todo siguió vivo porque un grupo de clientes impacientes no pudo agotar los recursos del servidor.

## ¿Rate limiting en el backend o en el API Gateway?

En un sistema real, generalmente lo quieres en **ambos**:

- **API Gateway / Load Balancer** (nginx, AWS API Gateway, Cloudflare): Primera línea de defensa. Bloquea tráfico malicioso antes de que llegue a tu app. Protege contra DDoS.
- **Aplicación** (tu código): Segunda línea. Límites específicos por lógica de negocio (por ejemplo, máximo 3 compras del mismo producto por usuario para evitar acaparadores).

El gateway protege tu infraestructura. Tu app protege tu negocio.

## Rate limiting no es hostilidad

Esto es importante: rate limiting no es ser malo con tus clientes. Es **proteger la experiencia de todos** tus clientes. Incluyendo los que no están haciendo nada mal.

Es como el límite de velocidad en una autopista. No existe para molestarte. Existe para que la autopista funcione para todos.

Una API sin rate limiting es una autopista sin límite de velocidad. Funciona bien con poco tráfico. El día que aparece un camión, un bot, o 5.000 personas emocionadas — se pudre todo.

## Esto es el Día 12

Este artículo es parte de **#100ArchitectureDays** — una serie de problemas reales de arquitectura con soluciones reales. Si tu API no tiene rate limiting, el próximo bot, el próximo lanzamiento, o el próximo Black Friday te va a recordar por qué lo necesitas.

Sigue la saga completa en **#100ArchitectureDays**.

Todo el código está en [GitHub](https://github.com/alafourcadev/100-architecture-days) — con una implementación manual del Token Bucket sin dependencias externas para que entiendas el algoritmo por dentro. Si te está sirviendo, déjame una estrella — es gratis y ayuda a que más gente lo encuentre.
