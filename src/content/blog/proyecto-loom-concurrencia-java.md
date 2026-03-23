---
title: "Revolucionando la Concurrencia en Java: Cómo el Proyecto Loom Simplifica y Mejora el Rendimiento"
description: "Cómo el Proyecto Loom Simplifica y Mejora el Rendimiento con hilos virtuales."
tags: ["Java", "Concurrency"]
date: 2024-06-24
readTime: "7 min read"
image: "/blog/proyecto-loom-concurrencia-java.webp"
---

La concurrencia en Java siempre fue poderosa pero compleja. El **Proyecto Loom** cambia las reglas del juego introduciendo **hilos virtuales** (virtual threads), una forma radicalmente más simple y eficiente de manejar tareas concurrentes.

## El problema con los hilos tradicionales

En Java, cada `Thread` tradicional está mapeado 1:1 a un hilo del sistema operativo. Esto tiene consecuencias serias:

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

## Hilos virtuales: la revolución

Con Proyecto Loom (disponible desde Java 21), los hilos virtuales son **extremadamente livianos**:

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

## ¿Cómo funciona?

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

El cambio es **una línea**. La mejora en throughput puede ser de **10x a 100x** para aplicaciones I/O bound.

## Spring Boot y Proyecto Loom

Spring Boot 3.2+ soporta hilos virtuales nativamente:

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

## Conclusión

Proyecto Loom no es solo una mejora — es un cambio de paradigma en cómo escribimos código concurrente en Java.

Ya no necesitás frameworks reactivos complejos (WebFlux, Project Reactor) solo para tener buena concurrencia. Podés escribir código **sincrónico, simple y legible**, y obtener el rendimiento que antes solo lograban las soluciones reactivas.

**Java se simplificó. Y eso es algo para celebrar.**
