---
title: "Día 15: Tu código es DRY pero nadie lo entiende. Bienvenido al infierno de la abstracción."
description: "Dos funciones parecidas no son la misma función. La abstracción incorrecta es peor que la duplicación, y probablemente tu codebase está lleno de ellas. Día 15 de #100ArchitectureDays."
tags: ["Java", "Spring Boot", "Architecture", "100ArchitectureDays"]
date: 2026-04-24
readTime: "7 min read"
image: "/blog/wrong-abstraction.webp"
day: 15
---

Te enseñaron que duplicar código es pecado. Que si ves dos bloques parecidos, tu deber es extraer un método, crear una abstracción, hacerlo DRY. Y lo hiciste. Fuiste buen developer. Sacaste la duplicación.

Seis meses después, ese método "genérico" tiene 7 parámetros, 4 if-else por tipo, casteos por todos lados, y nadie del equipo se anima a tocarlo. Cada feature nueva es un else-if más. Cada bug fix rompe otro caso. El método que iba a simplificar tu vida se convirtió en el lugar más peligroso de tu codebase.

No eliminaste complejidad. La concentraste.

## Esto le pasa a todos los stacks

El anti-pattern no tiene nada que ver con el lenguaje. Es una forma de pensar:

- **Java / Spring Boot**: un `EntityCreationService` genérico con casteos y `Map<String, Object>` para "datos extra"
- **TypeScript / NestJS**: un `createEntity<T>()` que recibe un `type: string` y hace switch interno
- **Python / Django**: una función `create_record()` con `**kwargs` que crece con cada modelo nuevo
- **Go**: una función `ProcessRequest` con `interface{}` y type assertions
- **Ruby / Rails**: un concern compartido entre modelos que no tienen nada en común salvo 3 líneas parecidas
- **PHP / Laravel**: un trait `Creatable` que necesita 5 overrides por modelo

Dos funciones se parecen. Alguien las "unifica". Y empieza el problema.

## El ejemplo: la abstracción que parece buena idea

Tienes dos endpoints. Uno crea usuarios, otro crea empresas. Los dos validan campos, guardan en base de datos y mandan un email. "Es lo mismo", dice alguien en el code review. Y nace el método genérico:

```java
@Service
public class EntityCreationService {

    public <T> T createEntity(T entity, String entityType,
                               String email, boolean sendWelcome,
                               boolean requiresApproval,
                               String approverEmail,
                               Map<String, Object> extraData) {

        validationService.validate(entity, entityType);

        if (entityType.equals("USER")) {
            ((User) entity).setRole("BASIC");
            if (extraData.containsKey("referralCode")) {
                applyReferralBonus((User) entity,
                    (String) extraData.get("referralCode"));
            }
        } else if (entityType.equals("COMPANY")) {
            ((Company) entity).setStatus("PENDING");
            if (requiresApproval) {
                emailService.sendApprovalRequest(approverEmail, entity);
            }
        } else if (entityType.equals("PARTNER")) {
            ((Partner) entity).setTier("STANDARD");
            // ... 20 líneas más
        }

        T saved = (T) repository.save(entity);

        if (sendWelcome) {
            if (entityType.equals("USER")) {
                emailService.sendUserWelcome(email);
            } else if (entityType.equals("COMPANY")) {
                emailService.sendCompanyOnboarding(email);
            } else if (entityType.equals("PARTNER")) {
                emailService.sendPartnerWelcome(email,
                    (String) extraData.get("partnerType"));
            }
        }

        return saved;
    }
}
```

Mira ese método. Un `entityType` string para saber qué tipo estás creando. Casteos a `(User)` y `(Company)`. Un `Map<String, Object>` como bolsa de basura para datos que no caben en la firma. Parámetros booleanos que controlan flujos. If-else por tipo de entidad, duplicados dos veces.

Esto NO es DRY. Esto es un switch statement disfrazado de abstracción. Y cada tipo de entidad nuevo que agregas lo hace peor.

## El test que delata todo

```java
@Test
void shouldCreateUser() {
    Map<String, Object> extra = new HashMap<>();
    extra.put("referralCode", "ABC123");

    service.createEntity(
        new User("Juan"),
        "USER",           // magic string
        "juan@mail.com",
        true,             // sendWelcome... ¿true o false?
        false,            // requiresApproval - no aplica para User
        null,             // approverEmail - no aplica para User
        extra             // bolsa genérica de datos
    );
}
```

Para testear la creación de un usuario tienes que pasar parámetros que no aplican: `requiresApproval`, `approverEmail`. Son ruido. Son parámetros de otra funcionalidad que viajan como polizones porque los metiste todos en el mismo método.

Cuando tus tests necesitan `null` y valores dummy para funcionar, la abstracción te está gritando que es incorrecta.

## La solución: duplicación honesta

```java
@Service
public class UserService {

    private final UserRepository userRepository;
    private final EmailService emailService;

    public User createUser(CreateUserRequest request) {
        User user = new User(request.name(), request.email());
        user.setRole("BASIC");

        if (request.referralCode() != null) {
            applyReferralBonus(user, request.referralCode());
        }

        User saved = userRepository.save(user);
        emailService.sendUserWelcome(saved.getEmail());
        return saved;
    }
}

@Service
public class CompanyService {

    private final CompanyRepository companyRepository;
    private final EmailService emailService;
    private final ApprovalService approvalService;

    public Company createCompany(CreateCompanyRequest request) {
        Company company = new Company(request.name(), request.email());
        company.setStatus("PENDING");

        if (request.requiresApproval()) {
            approvalService.requestApproval(company, request.approverEmail());
        }

        Company saved = companyRepository.save(company);
        emailService.sendCompanyOnboarding(saved.getEmail());
        return saved;
    }
}
```

¿Se parecen? Sí. ¿Son lo mismo? No. La creación de un usuario tiene referral codes. La creación de una empresa tiene un flujo de aprobación. Son procesos de negocio distintos que coinciden en la forma pero no en el fondo.

Y lo más importante: el día que cambia la lógica de usuarios, no tocas la de empresas. Cero efecto dominó. Cero miedo.

## Los números

| | Antes | Después |
|---|---|---|
| Parámetros del método | 7 | 1 (request object) |
| Casteos | 3+ | 0 |
| Magic strings | 3 | 0 |
| Clases afectadas al agregar tipo | 1 (la mega-clase) | 0 (clase nueva independiente) |

## Cómo detectar la abstracción incorrecta

Cuatro señales que no fallan:

**1. If/else por tipo dentro de un método "genérico".**
Si tu método genérico tiene branches por tipo, no es genérico. Es un switch statement con pasos extra.

**2. Parámetros que no aplican para todos los casos.**
Si un parámetro solo se usa cuando `entityType == "COMPANY"`, ese parámetro no debería existir en una firma genérica.

**3. El método crece con cada caso nuevo.**
Un método verdaderamente genérico no necesita cambiar cuando agregas un caso nuevo. Si tienes que agregar un `else if`, la abstracción no funciona.

**4. Tests con parámetros null o valores dummy.**
Si para testear un caso tienes que pasar `null` en 3 parámetros, esos parámetros no pertenecen ahí.

## La cita que importa

Sandi Metz lo dijo mejor que nadie:

> "Duplication is far cheaper than the wrong abstraction."

La duplicación tiene un costo lineal. Dos copias cuestan el doble. Tres copias el triple. Predecible.

La abstracción incorrecta tiene un costo exponencial: cada caso nuevo hace el método más complejo, más frágil, más difícil de entender. Y lo peor es que nadie se atreve a deshacerla porque "ya está ahí" y "todo lo usa".

## La regla del tres

Antes de extraer una abstracción:

1. **Primera vez:** escribe el código directamente.
2. **Segunda vez:** nota la similitud, pero duplica. Todavía no sabes si es coincidencia o patrón.
3. **Tercera vez:** ahora tienes tres casos reales. Ahora puedes ver qué es verdaderamente común y qué no.

Con tres casos, la abstracción se vuelve obvia. Con uno o dos, estás adivinando. Y adivinar la abstracción correcta es casi imposible.

## La pregunta que cambia todo

La próxima vez que veas código duplicado, antes de gritar "DRY", hazte una pregunta:

**¿Estas dos funciones se parecen porque hacen lo mismo, o se parecen por coincidencia?**

Si hacen lo mismo, unifica. Si se parecen por coincidencia, duplica sin culpa. Tu yo del futuro te lo va a agradecer.

Día 15 de **#100ArchitectureDays**.
