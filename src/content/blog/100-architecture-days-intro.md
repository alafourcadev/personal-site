---
title: "#100ArchitectureDays: 110 problemas reales de arquitectura, con código, sin humo"
description: "Arranco un reto de 110 días donde resuelvo un problema real de arquitectura de software por día. Con Spring Boot, código que compila, y métricas reales."
tags: ["Architecture", "Spring Boot", "100ArchitectureDays"]
date: 2026-04-01
readTime: "5 min read"
image: "/blog/100-architecture-days-intro.webp"
---

Tengo una frustración que me viene carcomiendo hace años.

Los seniors escriben código, no artículos. Los que enseñan muchas veces no tienen experiencia real. Y los juniors se quedan sin referentes — navegando entre tutoriales genéricos y cursos que te venden "arquitectura de microservicios" sin haber mantenido un monolito en producción.

Así que decidí hacer algo al respecto.

## El reto

**110 días. Un problema real de arquitectura por día. Código que compila. Métricas reales. Cero pseudocódigo.**

No voy a explicarte qué es el patrón Strategy con un ejemplo de animales que hacen sonidos. Voy a mostrarte cómo una decisión de diseño te arruina el response time en producción, y cómo la corregís con un refactor que podés aplicar mañana en tu proyecto.

Cada día vas a ver:

1. **Un problema real** — de esos que te aparecen un martes a las 3pm y nadie sabe por qué.
2. **Código ANTES** — el que escribimos cuando tenemos prisa, presión, o simplemente no sabemos algo mejor.
3. **Código DESPUÉS** — la solución con contexto, trade-offs, y explicación de por qué funciona.
4. **Métricas reales** — no "es más rápido". Cuánto más rápido. Medido. Con números.

## Los 5 bloques

Organicé los 110 días en bloques que siguen el camino que recorre cualquier dev que quiere pensar como arquitecto:

### Días 1-25: "¿Por qué mi app es tan lenta?"

Performance, diagnóstico y optimización. N+1 queries, connection pools, caching que realmente funciona, procesamiento asíncrono. Todo lo que necesitás para dejar de adivinar y empezar a medir.

### Días 26-50: "Mi código es un desastre y nadie lo entiende"

Patrones de diseño aplicados a problemas reales. Clean code que no es solo "nombres bonitos de variables". Refactors que transforman código frágil en código que tu equipo puede mantener sin llamarte a las 11 de la noche.

### Días 51-70: "El sistema se cayó y era viernes a las 6pm"

Resiliencia. Circuit breakers, retry policies, graceful degradation, health checks que sirven para algo. Cómo diseñar sistemas que fallan elegantemente en vez de explotar.

### Días 71-90: "Deployear me da miedo"

CI/CD, feature flags, blue-green deployments, rollback strategies. Si deployear te genera ansiedad, este bloque es para vos.

### Días 91-110: "Nadie entiende mis decisiones técnicas"

ADRs, diagramas que comunican, cómo defender una decisión técnica frente a negocio sin sonar como un robot. Porque la mejor arquitectura del mundo no sirve si no podés explicarla.

## Las reglas

Me puse reglas estrictas. Si no las cumplo, el ejercicio no tiene sentido:

- **Todo el código compila.** Si lo ves en un artículo, lo podés clonar y correr.
- **Métricas reales.** Benchmarks, profiling, datos concretos. No "esto es más performante" sin evidencia.
- **Nada de pseudocódigo.** Spring Boot, Java, herramientas que usamos en la vida real.
- **Sin consejos genéricos.** No voy a decirte "usá caché". Voy a mostrarte cuándo, cómo, y qué pasa cuando lo hacés mal.

## Para quién es esto

Si sos un developer que sabe programar pero quiere entender **por qué** se toman ciertas decisiones. Si querés dejar de ser la persona que implementa y empezar a ser la persona que diseña. Si estás cansado de leer "depende" como respuesta a todo y querés ver los trade-offs con código real.

Esto es para vos.

No necesitás ser senior. Necesitás tener curiosidad y ganas de entender cómo funcionan las cosas por debajo.

## Por qué lo hago

Porque me hubiera encantado tener algo así cuando estaba creciendo como developer. Porque la arquitectura de software no debería ser un conocimiento reservado para los que tuvieron la suerte de trabajar con buenos mentores. Y porque estoy convencido de que la mejor forma de aprender es hacer — y la mejor forma de enseñar es mostrar.

**110 días. 110 problemas. Código real.**

Mañana arrancamos con el Día 1: *"La primera carga tarda más que preparar un asado"*. Vamos a diagnosticar por qué tu aplicación tarda 15 segundos en arrancar y qué podés hacer al respecto.

Si querés seguir la serie, suscribite al blog o seguime en redes. Cada día hay un problema nuevo, una solución real, y algo que podés aplicar en tu proyecto.

Nos vemos mañana. Esto recién empieza.
