---
title: "Hilos virtuales en Java 21: adiós a WebFlux, hola a Proyecto Loom"
description: "Tu servidor aguanta 200 requests simultáneos? Con hilos virtuales de Java 21 puede manejar millones. Sin WebFlux. Sin Reactor. Código sincrónico puro."
tags: ["Java", "Concurrency"]
date: 2024-06-24
readTime: "7 min read"
image: "/blog/proyecto-loom-concurrencia-java.webp"
---

Voy a ser directo: si estás usando WebFlux o Project Reactor solo para aguantar más requests concurrentes, **estás sufriendo innecesariamente.**

Llevo años peleando con código reactivo en producción. Los `.flatMap()` encadenados, los errores imposibles de debuggear, los stack traces que no te dicen nada. Todo eso para resolver un problema que Java 21 ya resolvió con una línea de código.

Se llama **Proyecto Loom**. Y es la razón por la que en mis últimos dos proyectos no escribí ni una línea de código reactivo.

## El problema que nos metimos solos

En Java, cada `Thread` tradicional está mapeado 1:1 a un hilo del sistema operativo. Y acá es donde empieza el dolor:

```java
// Cada uno de estos consume ~1MB de stack memory
for (int i = 0; i < 10_000; i++) {
    new Thread(() -> {
        // hacer algo
        Thread.sleep(1000);
    }).start();
}
// Resultado: OutOfMemoryError o miles de context switches
```

- **Memoria**: Cada hilo consume ~1MB de stack. 10,000 hilos = ~10GB solo en stacks.
- **Context switching**: El OS tiene que alternar entre miles de hilos, perdiendo tiempo valioso.
- **Límite práctico**: En la mayoría de aplicaciones, no podés tener más de unos pocos miles de hilos.

## Hilos virtuales: la solución que debió llegar hace años

Ahora mirá esto. Con Proyecto Loom (Java 21), los hilos virtuales son **ridículamente livianos**:

```java
// Esto funciona sin problemas con hilos virtuales
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 1_000_000; i++) {
        executor.submit(() -> {
            Thread.sleep(Duration.ofSeconds(1));
            return "done";
        });
    }
}
// 1 millón de tareas concurrentes. Sin problema.
```

**Un millón de hilos virtuales.** Sin `OutOfMemoryError`. Sin context switching excesivo.

## ¿Cómo funciona? (sin buzzwords)

Los hilos virtuales se ejecutan sobre un pool de **carrier threads** (hilos del OS). Cuando un hilo virtual se bloquea (I/O, sleep, etc.), se **desmonta** del carrier thread, liberándolo para ejecutar otro hilo virtual.

```
Hilos Virtuales:    V1  V2  V3  V4  V5  V6  ... V1000000
                     ↓   ↓   ↓   ↓   ↓   ↓
Carrier Threads:    [C1] [C2] [C3] [C4]  (solo unos pocos)
                     ↓   ↓   ↓   ↓
OS Threads:         [T1] [T2] [T3] [T4]
```

Es como tener un restaurante con 4 meseros (carrier threads) que atienden a 1,000,000 de clientes (hilos virtuales). Cuando un cliente espera su comida, el mesero va a atender a otro.

## Ejemplo práctico: servidor HTTP

### Antes (hilos tradicionales)

```java
// Pool fijo — limita la concurrencia
ExecutorService executor = Executors.newFixedThreadPool(200);

server.setExecutor(executor);
// Máximo 200 requests simultáneos
```

### Después (hilos virtuales)

```java
// Un hilo virtual por request — sin límite práctico
ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

server.setExecutor(executor);
// Decenas de miles de requests simultáneos, fácil
```

El cambio es **una línea**. La mejora en throughput puede ser de **10x a 100x** para aplicaciones I/O bound. Y no tuviste que aprender Mono, Flux, ni sufrir con `.subscribeOn(Schedulers.boundedElastic())`.

## Spring Boot y Proyecto Loom

Si usás Spring Boot, esto te va a gustar. Spring Boot 3.2+ soporta hilos virtuales nativamente:

```yaml
# application.yml
spring:
  threads:
    virtual:
      enabled: true
```

**Una línea de configuración.** Todas tus requests ahora se sirven con hilos virtuales. Sin cambiar una sola línea de código de tu aplicación.

## ¿Cuándo usar hilos virtuales?

### ✅ Ideal para:
- **Aplicaciones I/O bound**: APIs REST, microservicios, acceso a bases de datos
- **Muchas conexiones simultáneas**: WebSockets, long polling, SSE
- **Tareas que esperan**: Llamadas HTTP a otros servicios, queries a DB

### ❌ No ideal para:
- **Tareas CPU-intensive**: Cálculos matemáticos, procesamiento de imágenes
- **Código con synchronized blocks**: Pueden causar "pinning" del carrier thread

## Benchmark simple

```java
// Comparación: 10,000 tareas que simulan I/O
long start = System.currentTimeMillis();

// Con hilos de plataforma: ~15 segundos (pool de 200)
// Con hilos virtuales: ~1 segundo

System.out.println("Tiempo: " + (System.currentTimeMillis() - start) + "ms");
```

La diferencia es brutal para cargas de trabajo I/O bound.

## Mi opinión después de usarlo en producción

Proyecto Loom no es solo una mejora — es la razón por la que dejé de recomendar WebFlux.

En los últimos dos proyectos donde lo implementé, eliminamos toda la capa reactiva. El código quedó más simple, los juniors lo entienden sin necesitar un curso de programación reactiva, y el rendimiento mejoró porque dejamos de pelear con el framework.

Ya no necesitás aprender Mono, Flux, ni sufrir con operadores que nadie recuerda. Podés escribir código **sincrónico, simple y legible**, y obtener el rendimiento que antes solo lograban las soluciones reactivas.

**Si estás empezando un proyecto nuevo en 2025 y alguien te sugiere WebFlux "por performance"... mandales este artículo.**
