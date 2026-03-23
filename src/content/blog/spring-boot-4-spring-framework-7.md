---
title: "Spring Boot 4 y Spring Framework 7: lo que cambió, lo que se rompió y lo que nadie te cuenta"
description: "Llevo meses migrando proyectos a Boot 4. Esto es todo lo que aprendí — con las cicatrices para probarlo."
tags: ["Java", "Spring Boot"]
date: 2026-03-23
readTime: "12 min read"
image: "/blog/spring-boot-4-spring-framework-7.webp"
---

Vamos directo al grano: **Spring Boot 4 no es un bump de versión. Es una reescritura de contrato.**

Si pensás que migrar es cambiar el `<version>` en tu `pom.xml` y rezar, te tengo malas noticias. Spring Framework 7 trajo cambios que van a romper tu aplicación de formas que no esperás. Y lo sé porque llevo meses migrando proyectos reales a producción.

Esto es todo lo que aprendí — lo bueno, lo que duele y lo que la documentación oficial no te dice con suficiente claridad.

## Lo primero: las bases cambiaron

| Dependencia | Boot 3.x | Boot 4.0 |
|---|---|---|
| Java mínimo | 17 | 17 |
| Java recomendado | 21 | 21+ (25 LTS ya soportado) |
| Jakarta EE | 10 | **11** |
| Hibernate | 6.x | **7.x** |
| Jackson | 2.x | **3.x** |
| Spring Security | 6.x | **7.x** |
| Kotlin | 1.9+ | **2.2+** |
| GraalVM | 23 | **25** |

No es un cambio cosmético. Es un salto generacional en prácticamente todas las dependencias.

## Lo bueno: features que valen la pena

### RestClient es ahora el estándar

`RestTemplate` está oficialmente en camino a la tumba. El timeline es claro:

- **Boot 4.0** (ahora): anuncio de intención de deprecar
- **Framework 7.1** (nov 2026): `@Deprecated` formal
- **Framework 8.0**: eliminación total

El reemplazo es `RestClient`, y es objetivamente mejor:

```java
// Antes — RestTemplate (verbose, difícil de testear)
ResponseEntity<Usuario> response = restTemplate.exchange(
    "/api/users/{id}", HttpMethod.GET, null,
    new ParameterizedTypeReference<Usuario>() {}, id
);

// Ahora — RestClient (fluido, limpio)
Usuario usuario = restClient.get()
    .uri("/api/users/{id}", id)
    .retrieve()
    .body(Usuario.class);
```

Pero lo mejor viene con `@HttpExchange` — interfaces declarativas que Boot 4 auto-configura:

```java
@HttpExchange("/api/users")
public interface UserClient {

    @GetExchange("/{id}")
    Usuario obtener(@PathVariable String id);

    @PostExchange
    Usuario crear(@RequestBody Usuario usuario);
}
```

Declarás la interfaz, Spring genera la implementación. Sin boilerplate. Sin `Feign`. Sin dependencias extra.

### Resiliencia integrada en el framework

Esto es grande. Spring Framework 7 trae `@Retryable` y `@ConcurrencyLimit` **sin necesidad de Spring Retry**:

```java
@EnableResilientMethods
@Configuration
public class AppConfig { }

@Service
public class PagoService {

    @Retryable // 3 intentos, 1s delay por defecto
    public Recibo procesarPago(Pago pago) {
        return gateway.cobrar(pago);
    }

    @ConcurrencyLimit(10) // máximo 10 ejecuciones simultáneas
    public Reporte generarReporte(String clienteId) {
        return reporteService.generar(clienteId);
    }
}
```

Dos anotaciones. Cero dependencias adicionales. Esto antes requería Spring Retry + configuración XML o una librería como Resilience4j. Ahora viene de fábrica.

### Virtual threads + RestClient = combo letal

RestClient en Boot 4 usa `JdkClientHttpRequestFactory` por defecto, que está construido sobre el `HttpClient` de Java — 100% compatible con virtual threads. Activás virtual threads y tu aplicación escala automáticamente:

```yaml
spring:
  threads:
    virtual:
      enabled: true
```

Tu `RestClient` hace llamadas HTTP sin bloquear carrier threads. Decenas de miles de requests concurrentes sin WebFlux, sin Reactor, sin programación reactiva. **Código sincrónico con rendimiento asincrónico.**

### Jackson 3: el cambio que nadie pidió pero todos necesitaban

Jackson cambió de package. Sí, leíste bien:

```java
// Antes (Jackson 2)
import com.fasterxml.jackson.databind.ObjectMapper;

// Ahora (Jackson 3)
import tools.jackson.databind.ObjectMapper;
```

Parece menor, pero hay cambios de comportamiento que te van a sorprender:

- **Fechas en ISO-8601 por defecto** — ya no timestamps numéricos
- **Excepciones unchecked** — `readValue()` ya no te obliga a hacer try-catch
- **Locale en formato IETF** — `zh-CN` en vez de `zh_CN`

Si no podés migrar de golpe, Boot 4 te deja usar Jackson 2 y 3 al mismo tiempo:

```yaml
spring:
  http:
    converters:
      preferred-json-mapper: jackson2
  jackson:
    use-jackson2-defaults: true
```

Pero no te engañes — Jackson 2 se va. Planificá la migración.

### Spring Data AOT: queries en compile-time

Spring Data ahora genera las queries en tiempo de compilación, no en runtime. El resultado: **50-70% más rápido en startup** para aplicaciones con muchos repositorios.

No tenés que hacer nada. Si usás AOT processing (y deberías), esto viene gratis.

## Lo que se rompió: las cicatrices de migrar

Acá es donde la documentación se queda corta. Esto me costó horas (y alguna noche) descubrir.

### Specification.where(null) ya no sirve

Si usás Spring Data JPA con Specifications, este código que tenías hace años **ya no funciona bien**:

```java
// ANTES — funcionaba "por suerte"
Specification<Cliente> spec = Specification.where(null);
if (filtro.getNombre() != null) {
    spec = spec.and(ClienteSpec.conNombre(filtro.getNombre()));
}
```

En Spring Data JPA 3.5+, `Specification.where(null)` es **ambiguo**. Puede generar `NullPointerException` con el `CriteriaBuilder`.

La solución:

```java
// AHORA — explícito y seguro
Specification<Cliente> spec = (root, query, cb) -> cb.conjunction();
if (filtro.getNombre() != null) {
    spec = spec.and(ClienteSpec.conNombre(filtro.getNombre()));
}
```

O mejor aún, usá `Specification.unrestricted()` que es exactamente para esto.

### OncePerRequestFilter + @Component = explosión

Esto me costó medio día de debugging. Si tenés un filtro así:

```java
@Component // ← ESTE ES EL PROBLEMA
public class MiFiltro extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(...) { ... }
}
```

**Boom.** CGLIB no puede hacer proxy de `OncePerRequestFilter` porque tiene un método `final init()`. Spring intenta crear un proxy, falla silenciosamente, y tu filtro se comporta de forma impredecible.

La solución: registralo como `@Bean`:

```java
@Configuration
public class FilterConfig {

    @Bean
    public FilterRegistrationBean<MiFiltro> miFiltro() {
        var registration = new FilterRegistrationBean<>(new MiFiltro());
        registration.setOrder(1);
        return registration;
    }
}
```

Nada de `@Component`. Nada de `@RefreshScope`. Los filtros se registran como beans, punto.

### Spring Security 7: APIs eliminadas sin piedad

Si todavía usás el DSL viejo de Security, preparate:

```java
// ESTO YA NO COMPILA EN SECURITY 7
http
    .authorizeRequests()  // ELIMINADO
    .antMatchers("/api/**")  // ELIMINADO
    .and()  // ELIMINADO
    .httpBasic();
```

Todo tiene que ser con lambdas y los nuevos matchers:

```java
// ASÍ SE HACE AHORA
http
    .authorizeHttpRequests(auth -> auth
        .requestMatchers("/api/**").authenticated()
        .anyRequest().permitAll()
    )
    .httpBasic(Customizer.withDefaults());
```

`authorizeRequests()` → `authorizeHttpRequests()`
`antMatchers()` → `requestMatchers()`
`.and()` → lambdas

No hay vuelta atrás. Estas APIs fueron eliminadas, no deprecadas.

### Undertow eliminado

Si usabas Undertow como servidor embebido: se fue. Incompatible con Servlet 6.1. Migrá a Tomcat o Jetty.

### ClientHttpRequestFactories no existe

Si venís de Boot 3.x y usabas `ClientHttpRequestFactories` o `ClientHttpRequestFactorySettings` para configurar tu RestClient — esas clases **no existen en Boot 4.0.3**. Usá `SimpleClientHttpRequestFactory` directamente.

## Cómo migrar sin morir en el intento

### 1. Pasá por Boot 3.5 primero

Spring Boot 3.5 es el **puente oficial**. Depreca todo lo que 4.0 elimina, con warnings de compilador. Así sabés exactamente qué rompe antes de dar el salto.

### 2. Usá OpenRewrite

```bash
# Receta oficial de migración
mvn rewrite:run -Drewrite.recipeArtifactCoordinates=\
  org.openrewrite.recipe:rewrite-spring:LATEST \
  -Drewrite.activeRecipes=\
  org.openrewrite.java.spring.boot4.UpgradeSpringBoot_4_0
```

OpenRewrite automatiza el 70-80% de los cambios mecánicos: imports de Jakarta, Jackson 3, Security DSL. El resto es manual y requiere entender tu código.

### 3. No migres todo junto

Migré tres proyectos a Boot 4. En los tres, la estrategia que funcionó fue:

1. Primero el framework (Boot + Security + JPA)
2. Después Jackson 3 (con el flag de compatibilidad)
3. Después los tests (que son los que más se rompen)

Intentar todo junto es receta para el desastre.

## ¿Vale la pena?

Sí. Sin dudas.

Virtual threads + RestClient + resiliencia integrada + AOT queries hacen que Boot 4 sea objetivamente superior. El startup es más rápido. El throughput es mayor. El código es más limpio.

Pero no es gratis. La migración requiere trabajo real, especialmente si tenés una base de código grande con Security viejo, Specifications con nulls, y filtros como `@Component`.

**Spring Boot 4 no te pide que actualices tu código. Te pide que lo hagas bien de una vez.**

Y si todavía estás en Boot 2.x... bueno, ese es un problema que merece su propio artículo.
