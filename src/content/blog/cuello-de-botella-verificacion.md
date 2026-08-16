---
title: "Escribir código dejó de ser el cuello de botella. Verificarlo, no."
description: "Probás que 2 + 2 da 4. ¿Probaste alguna vez que tu sistema cumple con la arquitectura que definiste? Nadie lo hace, y ese hueco se paga en cada PR. #100ArchitectureDays"
tags: ["Java", "Architecture", "Testing", "100ArchitectureDays"]
date: 2026-08-13
readTime: "12 min read"
image: "/blog/day-024-cuello-de-botella-verificacion-v2.webp"
draft: false
day: 24
---

Desde que arrancamos a programar nos dicen que hay que probar que 2 + 2 da 4.

Y está perfecto. Hay que probarlo.

Pero te hago otra pregunta: **¿alguna vez probaste que tu sistema cumple con la arquitectura que vos definiste?**

Ojo con lo que dice. No que la documentaste. No que la dibujaste en Confluence. No que la explicaste en el onboarding. Que la probaste, con un test que se pone rojo cuando alguien la rompe.

Casi nadie levanta la mano.

## De dónde me salió esta pregunta

Estuve dos meses sin escribir acá. Estaba construyendo La Forja: un lugar donde diseñás un sistema arrastrando cajas y flechas, y algo te dice en el momento si tu diseño se sostiene o no. No al final del sprint. En el momento.

La respuesta fue bastante mejor de la que esperaba, y de ahí vienen cosas que todavía no puedo contar.

Pero construirla me dejó incómodo. Pasé dos meses haciendo una herramienta que verifica decisiones de arquitectura al instante, y en veintitrés días de esta serie nunca hablé de lo más obvio: en los sistemas reales, esa verificación no la hace nadie. Se hace a ojo, en un review, si el que revisa está fresco y se acuerda de la decisión.

Hoy hablamos de eso. De QA, pero desde la silla del arquitecto.

## Lo que revisás en un PR y ningún test cubre

Es martes. Te llega un PR de doscientas líneas.

No revisás si 2 + 2 da 4. Eso lo cubre un test y lo cubre bien.

Lo que revisás es otra cosa. Revisás que el cálculo del descuento no haya terminado adentro del repositorio. Que el controller reciba, valide y delegue, y no que abra una transacción y arme una query a mano. Que la entidad de dominio no importe nada de Spring. Que el módulo de facturación no vaya directo contra la tabla de clientes de otro módulo.

Eso es lo que de verdad te quita el sueño. Andá a contar cuántos tests de tu suite verifican algo de eso.

Cero.

Tenés miles de tests sobre el comportamiento del sistema y ninguno sobre su estructura. Es decir: sobre la única propiedad de la que vos, como arquitecto, sos responsable.

## Por qué duele: se filtra de a una línea

Como no hay test, la sostenés a mano. Con los ojos. En un review.

Un martes que estás cansado. La semana que estás de vacaciones. El día que entra alguien que no estuvo en la reunión donde se decidió que la lógica va en el dominio, y que además está apurado porque el ticket es para ayer.

Y ahí se filtra. Nunca de golpe: de a una línea, en PRs que uno por uno parecen razonables. Ninguno de esos PRs merece un rechazo. La suma sí.

Seis meses después la lógica de negocio vive en tres capas distintas y nadie se acuerda de cuándo pasó.

Ahora sumale lo que cambió este año.

Tu equipo adoptó IA. Produce tres veces más código. Y esa vigilancia manual, que ya era frágil cuando entraban cuatro PRs por semana, ahora tiene que cubrir el triple de superficie con la misma gente y los mismos ojos.

No es que la IA metió el problema. El problema estaba. La IA le subió el caudal.

## Aceleraste la etapa que no era el cuello de botella

Esto es teoría de restricciones aplicada a un equipo de software, y es incómodo justamente porque es elemental.

Si un proceso tiene varias etapas y una es el cuello de botella, acelerar cualquier otra no mejora nada. Lo único que conseguís es una cola más larga delante del cuello real. Peor: la cola tiene costo. Cada PR que espera se desactualiza, entra en conflicto y pierde contexto en la cabeza del que lo escribió.

Durante veinte años el cuello de botella del software fue escribirlo. Y estuvo bien optimizar eso, porque era verdad. Reuso, DRY, frameworks, generadores, abstracciones: todo lo que aprendimos de arquitectura apunta a que escribir salga más barato.

Ninguna de esas decisiones optimizó verificación. Y no fue por tontos. Fue porque cuando escribir es lo caro, lo otro no se mide.

Ahora hay un generador infinito de código del otro lado de un embudo que sigue siendo del ancho de siempre. Y el embudo se ve.

## La trampa: creer que esto es un problema de testing

Acá casi todo el mundo hace el mismo movimiento, y lo entiendo porque yo también lo hice.

Se lee como un problema de testing. Entonces se compra solución de testing: subir la meta de coverage, cambiar de framework, sumar gente de QA, poner un agente a generar tests. Todo eso se aprueba rápido porque suena responsable.

Y ojo, que aprender a verificar bien es un oficio entero y de verdad. Si lo que querés es eso, subir de nivel en QA, armar tu automatización, entender el harness, meterte con agentes aplicados a calidad, no lo vas a encontrar acá. Lo vas a encontrar en [Calidad sin Humo](https://calidadsinhumo.com/), el blog de Adriana Troche, que lo cubre desde [el salto de manual a automatización](https://calidadsinhumo.com/guias/guia-de-qa-manual-a-automatizacion/) hasta armar equipos de agentes de QA. Ella enseña el oficio completo y lo enseña bien.

Este post es la otra mitad del problema.

Porque hay dos cosas que ninguna herramienta de QA te va a resolver. La primera es que tu sistema haga cara la verificación por diseño. La segunda es esa pregunta del principio, la de la arquitectura, que directamente no está en el mapa de nadie.

Y antes de ir ahí, conviene mirar los tests que ya tenés. Porque muchos tampoco están probando lo que creés.

## Cinco tests en verde que no prueban nada

### 1. El que verifica el mock, no el sistema

```java
when(repo.save(any())).thenReturn(orden);
service.crear(dto);
verify(repo).save(any());
```

Verificaste que llamaste a `save`. No que se guardó. No que el total quedó bien. No que el estado es coherente.

Mañana una constraint de la base rechaza ese insert en producción y este test sigue verde, porque nunca hubo una base del otro lado. Lo único que probaste es que tu código llama a un objeto que vos mismo programaste para que diga que sí.

### 2. El que se calcula la respuesta a sí mismo

```java
BigDecimal esperado = precio.multiply(cantidad)
                            .multiply(BigDecimal.ONE.add(IVA));

assertThat(factura.getTotal()).isEqualTo(esperado);
```

Este es el que más duele, porque lo hacemos todos y se ve prolijo.

Copiaste la fórmula de producción al test. Si la fórmula está mal, las dos están mal exactamente igual, y el test pasa. No estás verificando el cálculo: estás verificando que sabés copiar y pegar.

Un oráculo que se deriva del código que prueba no es un oráculo. El valor esperado tiene que venir de otro lado: de la regla de negocio escrita, de un caso que alguien calculó a mano, de la factura real que emitió el sistema viejo. De cualquier lado menos de la misma fórmula.

### 3. El 200 OK

```java
mockMvc.perform(post("/ordenes").content(json))
       .andExpect(status().isOk());
```

200 significa que el controller no explotó. Nada más.

No significa que la orden se creó. No significa que se descontó stock. No significa que el precio quedó bien, ni que se disparó el evento, ni que el cliente quedó notificado. Verificaste el transporte y cero reglas de negocio.

### 4. El que depende de hoy

```java
assertThat(suscripcion.estaVigente()).isTrue();
```

Con un `LocalDate.now()` adentro del dominio.

Pasa hoy. Pasa mañana. Y nunca prueba el borde, que es lo único interesante de una fecha de vencimiento. El día que falla es un 31 de diciembre a las 23:59 y nadie va a entender por qué.

### 5. El que pasa por el orden en que corre

El test A crea el usuario. El test B lo busca. En tu máquina corren en ese orden y está todo verde.

En CI, con paralelismo, se cae. Y el equipo lo etiqueta como flaky, lo marca para reintentar y sigue. Pero flaky no es una categoría de test: es el nombre que le ponemos a un test que nos está avisando algo que no queremos escuchar. Acá te está avisando que no tenés control del estado de tu sistema.

Si estos cinco te resultaron familiares, la pregunta obvia es cuántos de tus tests están en esa lista. Y eso se mide: existe una técnica que rompe tu código a propósito para ver si algún test se entera. Adriana la explica en [mutation testing, la técnica que nadie usa](https://calidadsinhumo.com/posts/mutation-testing-la-tecnica-que-nadie-usa/).

## El test que sí falta: verificar la estructura

Los cinco de arriba tienen algo en común: todos discuten si el sistema **hace** lo correcto. Y eso hay que verificarlo, sin discusión.

Pero volvamos a la pregunta del principio, la que casi nadie contesta que sí.

Verificar si el sistema **está armado** como decidiste que estuviera armado es otro problema, y no lo cubre ningún test de comportamiento. Podés tener el cien por ciento de coverage y la lógica de negocio desparramada en tres capas. Las dos cosas conviven perfecto.

Y sí se puede verificar. La estrategia se llama verificar la estructura, no solo el comportamiento.

Funciona así: elegís cuáles de tus reglas de arquitectura son innegociables, las escribís como reglas sobre quién puede depender de quién, y las hacés correr como un test más. No es una herramienta aparte, no es un proceso nuevo, no es un paso extra en el pipeline. Es tu suite de siempre corriendo en tu CI de siempre.

En Java el ejemplo más directo es ArchUnit, y se lee así:

```java
@Test
void el_dominio_no_conoce_la_infraestructura() {
    noClasses().that().resideInAPackage("..domain..")
        .should().dependOnClassesThat()
        .resideInAnyPackage("..infrastructure..", "..web..")
        .check(clases);
}
```

Si alguien mete un `@Repository` adentro del dominio, el build se pone rojo. No en el review. No en la retro tres sprints después. En el build, a los cuarenta segundos, sin que vos tengas que estar mirando.

La herramienta cambia según tu stack, y da lo mismo cuál uses. Lo que no cambia es la decisión de fondo: elegir qué reglas de tu arquitectura son innegociables y convertirlas en algo que se rompe solo cuando alguien las viola. Si esa decisión no la tomás vos, la va a tomar el próximo PR apurado.

Eso convierte tu arquitectura en algo ejecutable. Deja de ser un diagrama que nadie abre, y deja de ser una decisión que defendés de memoria cada vez que entra alguien nuevo.

Le voy a dedicar un día entero más adelante en esta temporada, porque tiene su propia letra chica: qué reglas vale la pena fijar, cuáles te van a hacer la vida imposible, y qué hacés con las excepciones legítimas.

Por ahora quedate con esto:

**Tu arquitectura, si no falla el build, es una sugerencia.**

## Por qué verificar te sale caro: las cinco causas

Que la estructura no se verifique es el agujero más grande. Pero verificar el comportamiento tampoco es gratis, y su precio también lo fijó tu diseño.

Ninguna de estas cinco se compra. Todas se decidieron en algún momento, sin saber que se estaba decidiendo esto.

**1. No hay costuras.** No existe forma de entrar al sistema sin levantarlo entero. Cada mock que escribís es una dependencia que nadie invirtió, y cada verificación termina costando un entorno completo. El costo se paga en minutos de CI y en gente esperando.

**2. El estado es implícito y compartido.** No podés poner el sistema en un estado conocido, entonces no podés repetir una condición. Y si no podés repetirla, el resultado no te dice nada: te dice qué pasó esa vez.

**3. El tiempo, el azar y la red están cableados en la lógica.** Sin determinismo no verificás, estimás. Y un test que estima es un test que algún día vas a marcar como flaky en vez de leerlo.

**4. No hay oráculo.** No existe forma barata de responder "¿esto está bien?" que no sea un humano mirando una pantalla. Ese humano es tu cuello de botella y no escala, por más IA que tengas del otro lado.

**5. Los límites técnicos no son los del negocio.** Toda prueba con sentido real cruza cinco módulos y tres equipos, porque el caso de uso está repartido. Verificar una regla se convierte en coordinar una reunión.

Cada una de estas cinco tiene su día en esta temporada, con el corte hecho en código.

## La radiografía de tu repo en cinco comandos

Antes de discutir nada en abstracto, sacá tus propios números. Sobre Java, con `ripgrep`:

```bash
# Causa 1: tests con más de 5 mocks
rg -c '@Mock|Mockito\.mock\(' --glob 'src/test/**/*.java' | awk -F: '$2>5'

# Causa 3: el reloj cableado adentro de la lógica
rg -l 'LocalDate\.now\(\)|LocalDateTime\.now\(\)|new Date\(\)' --glob 'src/main/**/*.java'

# Causa 3 bis: el sleep que compra determinismo con tiempo de tu vida
rg -c 'Thread\.sleep' --glob 'src/test/**/*.java'

# Causa 4: tests que solo verifican que no explotó
rg -c 'assertNotNull|isEqualTo\(200\)' --glob 'src/test/**/*.java'

# Causa 2: estado compartido entre tests
rg -l '@DirtiesContext|static .* [A-Z_]+ =' --glob 'src/test/**/*.java'
```

Con la advertencia honesta: son heurísticas, no verdad. Te dicen dónde mirar, no qué está mal. Un `LocalDate.now()` en un adaptador de entrada está perfecto. El mismo `LocalDate.now()` adentro de una regla de negocio te acaba de costar la verificabilidad de ese módulo entero, porque ya no hay forma de preguntarle qué pasa el 31 de diciembre.

## La regla

La velocidad de tu equipo no es cuánto código produce. Es cuánto código puede verificar por unidad de tiempo.

Y ese número no lo fija la IA, ni tu proveedor de CI, ni el tamaño de tu equipo de QA. Lo fijaste vos, en decisiones de arquitectura que tomaste hace tres años, cuando el costo dominante era otro y nadie te dijo que estabas fijando esto.

Si querés llevarte una sola cosa hoy, llevate la pregunta del principio y hacésela en tu próxima reunión de diseño: ¿qué reglas de nuestra arquitectura son innegociables, y cuál de ellas podríamos poner en rojo en el build esta semana?

Con una alcanza para empezar. Una regla que se rompe sola vale más que un diagrama que todos dicen respetar.

Los próximos siete días de esta serie son las cinco causas, una por día, con el corte hecho en código real. Arrancamos por las costuras, que es donde vive la frase más cara del oficio: "para probar esto tengo que levantar todo".

---

Si querés recibir una lección semanal de arquitectura, producción e IA sin filtros, suscribite a La Bitácora Sin Filtros.
