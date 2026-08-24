---
title: "Cada mock que escribís es una dependencia que no invertiste"
description: "Probar una multiplicación te cuesta levantar Docker, correr migraciones y esperar 40 segundos. El problema no es cuántos mocks tenés: es dónde están parados. #100ArchitectureDays"
tags: ["Java", "Architecture", "Testing", "100ArchitectureDays"]
date: 2026-08-21
readTime: "11 min read"
image: "/blog/day-025-mocks-dependencias-sin-invertir-v2.webp"
draft: false
day: 25
---

Querés probar una regla de negocio. Una sola.

El descuento por volumen: si el cliente compra más de 50 unidades, se le aplica un 12%. Con un tope acumulado del 30% si además es cliente VIP y hay una promoción vigente.

Para verificar eso tenés que levantar un contenedor con Postgres, correr las migraciones, insertar un cliente, tres productos y una orden, armar un doble del servicio de cotización del otro equipo, y esperar cuarenta segundos a que arranque el contexto de Spring.

Todo eso para comprobar una multiplicación y una comparación.

Y lo peor no es el tiempo. Lo peor es que ya te acostumbraste. Es "lo normal". Es "así es esto".

No es así. Ayer hablamos de por qué verificar se volvió el cuello de botella de tu equipo. Hoy vamos por la primera de las cinco causas, que es la más común y la más cara: **tu sistema no tiene por dónde entrar.**

## El código del crimen

Este servicio existe, con otros nombres, en todos los sistemas en los que trabajé:

```java
@Service
public class PrecioService {
    private final OrdenRepository ordenRepo;
    private final ClienteRepository clienteRepo;
    private final DescuentoRepository descuentoRepo;
    private final CotizacionClient cotizacion;

    public BigDecimal calcular(Long ordenId) {
        Orden orden = ordenRepo.findById(ordenId).orElseThrow();
        Cliente cliente = clienteRepo.findById(orden.getClienteId()).orElseThrow();
        List<Descuento> vigentes = descuentoRepo.findVigentes(cliente.getId());
        BigDecimal tasa = cotizacion.tasaDelDia(orden.getMoneda());

        // 30 líneas de reglas: escalas por volumen, tope acumulado,
        // recargo por moneda extranjera, redondeo, impuestos.
        return total;
    }
}
```

Leelo de nuevo, pero mirando otra cosa. No mires si está bien escrito, que lo está. Mirá **dónde está parada la regla de negocio**.

Está adentro de un método que además abre cuatro puertas hacia afuera. Y no hay forma de llegar a la regla sin pasar por las cuatro.

Su test, entonces, arranca así:

```java
@Mock OrdenRepository ordenRepo;
@Mock ClienteRepository clienteRepo;
@Mock DescuentoRepository descuentoRepo;
@Mock CotizacionClient cotizacion;
```

Cuatro dobles para probar una multiplicación. Y a cada uno hay que enseñarle qué contestar antes de poder empezar.

## Por qué duele, más allá de los cuarenta segundos

**Primero, el costo obvio.** Cada corrida cuesta minutos, y esos minutos se multiplican por cada persona del equipo, por cada push, todos los días. Pero ese es el costo que se ve, y no es el que te hunde.

**Segundo, escribís menos casos de los que sabés que tenés que escribir.** Si agregar un caso de borde cuesta veinte líneas de preparación, no vas a escribir los doce casos de borde de esa regla. Vas a escribir dos y seguir. No por vago: porque el precio por caso es demasiado alto y tu tiempo es finito. La cobertura real de tu lógica más delicada la termina fijando el costo de escribir, no la importancia del caso.

**Tercero, y es el que congela tu sistema.** Un test con cuatro dobles no describe qué logra tu código. Describe cómo lo hace: a quién le pide qué, en qué orden, cuántas veces.

```java
verify(descuentoRepo).findVigentes(7L);
verify(cotizacion, times(1)).tasaDelDia("USD");
```

Ese test está atado a la forma interna de tu método. El día que reordenás algo por adentro, o que juntás dos consultas en una, o que le cambiás el nombre a un método, se te ponen en rojo cuarenta tests. Sin un solo bug. El sistema hace exactamente lo mismo que antes y mejor que antes.

La primera vez pasa y se arregla. La tercera vez, el equipo aprende la lección equivocada: mejor no tocar nada.

Y ahí el sistema deja de mejorar. No porque el código sea intocable, sino porque los tests lo volvieron intocable.

## La trampa: creer que sobran mocks

La conclusión natural es "estamos usando demasiados mocks, hay que usar menos".

Con esa conclusión no llegás a ningún lado, y vale la pena entender por qué.

No te sobran. Los necesitás. Ese servicio no arranca sin los cuatro, porque de verdad depende de los cuatro. Sacar mocks sin tocar el diseño solo te deja con un test que levanta la base real, tarda tres minutos y falla los viernes.

La segunda versión de la trampa es cambiar de herramienta: otro framework de dobles, uno que mockee más lindo o con menos ceremonia. Eso te ahorra tipeo y no te ahorra ni un solo problema, porque el problema no está en cómo escribís el doble. Está en por qué lo necesitás.

Y la tercera, la más cara, es rendirse y mandar todo a tests de integración. Ahí ganás realismo y perdés las dos cosas que necesitabas: velocidad para escribir muchos casos, y precisión para saber qué se rompió cuando algo falla.

**El problema no es cuántos mocks tenés. Es dónde están parados.**

## La decisión: mover la regla, no sacar el mock

Mirá otra vez dónde están los cuatro dobles en el ejemplo. Están rodeando las 30 líneas donde vive la lógica que te paga el sueldo.

Y esa lógica no necesita la base de datos. Necesita **los datos**. Son dos cosas distintas y las tenemos pegadas hace años.

### Paso 1: el cálculo, solo

```java
public class CalculadoraDePrecio {

    public BigDecimal calcular(Orden orden,
                               Cliente cliente,
                               List<Descuento> vigentes,
                               BigDecimal tasa) {
        // exactamente las mismas 30 líneas de reglas
    }
}
```

Sin anotaciones. Sin repositorios. Sin framework. Recibe lo que necesita ya resuelto.

Su test completo:

```java
var total = calculadora.calcular(orden60Unidades, clienteVip,
                                 List.of(promoVigente), TASA_USD);

assertThat(total).isEqualByComparingTo("890.00");
```

Cero dobles. Tres líneas. Y ahora escribir el caso doce cuesta lo mismo que escribir el caso uno, así que los vas a escribir todos: el borde de las 50 unidades exactas, el tope acumulado que se pasa, el redondeo del centavo, la moneda que no cotiza.

### Paso 2: lo que queda del servicio

```java
@Service
public class PrecioService {

    public BigDecimal calcular(Long ordenId) {
        Orden orden = ordenRepo.findById(ordenId).orElseThrow();
        Cliente cliente = clienteRepo.findById(orden.getClienteId()).orElseThrow();
        List<Descuento> vigentes = descuentoRepo.findVigentes(cliente.getId());
        BigDecimal tasa = cotizacion.tasaDelDia(orden.getMoneda());

        return calculadora.calcular(orden, cliente, vigentes, tasa);
    }
}
```

Y acá está la parte que no se entiende sola, así que la digo despacio.

**Los cuatro mocks no desaparecieron del sistema.** Si querés probar `PrecioService`, los seguís necesitando. Nada los eliminó.

Lo que cambió es **dónde viven**.

Antes, las 30 líneas de reglas de negocio necesitaban cuatro dobles para poder probarse. Ahora esas reglas se prueban con cero, y lo que sigue necesitando cuatro son cinco líneas de plomería que no deciden absolutamente nada. Y algo que no decide nada tampoco tiene mucho para fallar: ese método se cubre con un test de integración y listo.

No sacaste mocks. Sacaste las reglas de donde estaban los mocks.

### Paso 3: cuando igual necesitás el doble, que no finja

Para el `PrecioService` te siguen haciendo falta dobles. Pero hay dos formas de escribirlos y no son equivalentes.

Esto le enseña a un objeto falso qué contestar:

```java
when(clienteRepo.findById(7L)).thenReturn(Optional.of(clienteVip));
```

Ese test ahora sabe que el método se llama `findById`, que recibe un `Long` y que devuelve un `Optional`. Cambiá cualquiera de esas tres cosas sin cambiar el comportamiento y el test se rompe.

Esto, en cambio, es una implementación de verdad, simple:

```java
class ClientesEnMemoria implements ClienteRepository {
    private final Map<Long, Cliente> datos = new HashMap<>();

    public void guardar(Cliente c)             { datos.put(c.getId(), c); }
    public Optional<Cliente> findById(Long id) { return Optional.ofNullable(datos.get(id)); }
}
```

Y el test pasa a leerse así:

```java
clientes.guardar(clienteVip);
```

La diferencia no es estética. La primera versión dice "cuando te llamen `findById` con 7, devolvé esto", o sea describe la mecánica interna de tu código. La segunda dice "existe este cliente", o sea describe el mundo.

Las reglas del mundo cambian mucho menos seguido que la mecánica de tu código. Por eso la segunda sobrevive a los refactors y la primera no.

Cuesta más escribirla, sí: son diez líneas la primera vez. Pero se escribe una sola vez por interfaz y la usan todos los tests del módulo para siempre.

Sobre cómo se arma bien toda esa infraestructura de pruebas, que es un oficio en sí mismo, Adriana lo desarrolla en [anatomía de un harness](https://calidadsinhumo.com/posts/anatomia-de-un-harness/). Acá me quedo en la decisión de diseño que la hace posible o imposible.

## El costo, porque siempre hay uno

`calcular` ahora recibe cuatro cosas en lugar de un id. Si mañana la regla necesita un quinto dato, tocás la firma y tocás a todos los que la llaman.

Eso es real y no lo voy a maquillar. Ganaste testabilidad y pagaste con una firma más ancha y una clase más en el sistema.

**Se paga cuando adentro hay reglas que valen la pena proteger.** Escalas, topes, redondeos, condiciones que el negocio cambia dos veces por año: ahí el precio es barato y lo recuperás la primera semana.

**No se paga cuando no hay reglas.** Si tu servicio lee de la base, mapea a un DTO y devuelve, no hay nada que separar. Extraer una `CalculadoraDeNada` que recibe cuatro parámetros y no decide nada es peor que el original: agregaste una capa para no ganar nada. Ese servicio se prueba entero, contra una base de verdad, y se termina la discusión.

La pregunta que resuelve el caso no es "¿esto tiene muchas dependencias?". Es **"¿acá adentro hay una decisión de negocio que quiero poder cambiar sin miedo?"**. Si la respuesta es no, dejalo pegado.

## La regla

El umbral, para que no sea una sensación: **más de tres dobles en un test unitario.** Ahí frenás y mirás qué hay adentro de esa clase.

Tres no es un número mágico, es un disparador. Cuatro colaboradores en una clase que además tiene reglas de negocio es casi siempre la misma historia contada de nuevo.

Y cuando lo encontrás en un PR ajeno, el comentario importa tanto como el diagnóstico. Este funciona:

> Este test necesita 5 dobles para arrancar. Eso me dice que `PrecioService` tiene 5 colaboradores y además tiene las reglas del descuento adentro. ¿Sacamos el cálculo a una clase sin dependencias, que reciba los datos ya resueltos? El test del cálculo queda sin dobles y podemos cubrir los bordes que hoy no están, y este queda sin reglas que probar.

Fijate que no dice "usá menos mocks". Un comentario que solo señala el olor abre una discusión sobre gustos. Uno que propone el corte concreto y nombra lo que se gana, se responde con un sí o con un contraargumento técnico. Las dos respuestas sirven.

Mañana seguimos con la segunda causa, que es la que hace que tus tests pasen o fallen según el orden en que corren: no podés poner tu sistema en un estado conocido.

---

Si querés recibir una lección semanal de arquitectura, producción e IA sin filtros, suscribite a La Bitácora Sin Filtros.
