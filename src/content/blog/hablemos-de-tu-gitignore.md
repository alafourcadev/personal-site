---
title: "Oye, tenemos que hablar sobre tu .gitignore"
description: "Está mal y te voy a demostrar por qué. 8 minutos que te van a ahorrar años de frustración."
tags: ["Git", "Best Practices"]
date: 2025-08-04
readTime: "8 min read"
image: "/blog/hablemos-de-tu-gitignore.webp"
---

Vamos directo al grano: tu `.gitignore` está mal. Y no es culpa tuya — es culpa de que nadie te enseñó a hacerlo bien.

## El problema

Abrí cualquier repositorio en tu organización. Te apuesto lo que quieras a que el `.gitignore` tiene algo así:

```
# IDE
.idea/
.vscode/
*.iml

# OS
.DS_Store
Thumbs.db

# AI tools
.cursor/
.copilot/
```

¿Qué tienen en común todas estas líneas? **Ninguna tiene que ver con el proyecto.**

Son archivos de **tu entorno personal**. Tu IDE. Tu sistema operativo. Tus herramientas.

## ¿Por qué está mal?

Porque el `.gitignore` del proyecto debería ignorar solo cosas **del proyecto**:

```
# Build output
/target/
/build/
/dist/

# Dependencies
/node_modules/

# Environment
.env
.env.local

# Logs
*.log
```

Eso es todo. Limpio. Específico. Relevante.

## La solución: .gitignore global

Git tiene un mecanismo que casi nadie usa: el `.gitignore` **global**.

```bash
git config --global core.excludesfile ~/.gitignore_global
```

Ahora creás `~/.gitignore_global`:

```
# === Mi IDE ===
.idea/
.vscode/
*.iml
*.swp
*.swo

# === Mi OS ===
.DS_Store
.DS_Store?
._*
Thumbs.db
ehthumbs.db
Desktop.ini

# === Mis herramientas ===
.cursor/
.copilot/
.claude/
```

**Se aplica a TODOS tus repositorios, automáticamente.**

## ¿Por qué importa?

### 1. Escalabilidad del equipo

Cada persona en tu equipo usa herramientas diferentes:
- Ana usa IntelliJ
- Carlos usa VS Code
- María usa Neovim
- Pedro usa Cursor

Si cada uno agrega sus archivos al `.gitignore` del proyecto, terminás con un archivo de 50 líneas que no tiene nada que ver con el proyecto.

### 2. Pull requests innecesarios

"Hey, agregué `.cursor/` al gitignore."

Eso no debería ser un PR. Eso debería ser tu configuración personal.

### 3. Conflictos de merge

Dos personas agregan entradas al `.gitignore` en branches separados. Merge conflict. Sobre un archivo que ni siquiera debería tener esos cambios.

## El flujo correcto

1. **`.gitignore` del proyecto**: Solo archivos generados por el build, dependencias, y configs locales del proyecto.
2. **`.gitignore` global**: Todo lo que es específico de tu entorno personal.
3. **Documentación**: Un `README` o `CONTRIBUTING.md` que explique qué herramientas pueden necesitar configuración especial.

## Configuración recomendada para equipos

Creá un archivo `.gitignore_global` estándar y compartilo con tu equipo:

```bash
# Cada miembro del equipo ejecuta:
git config --global core.excludesfile ~/.gitignore_global

# Y copia el archivo estándar:
curl -o ~/.gitignore_global https://tu-repo/gitignore_global
```

Así todos tienen la misma base, pero cada uno puede agregar sus propias herramientas sin contaminar el repositorio.

## Bonus: template para tu .gitignore de proyecto

```
# === Build ===
/target/
/build/
/dist/
/out/

# === Dependencies ===
/node_modules/
/.gradle/
/.m2/

# === Environment ===
.env
.env.local
.env.*.local

# === Logs ===
*.log
logs/

# === Test coverage ===
/coverage/
/htmlcov/
```

**Limpio. Relevante. Mantenible.**

## Conclusión

Tu `.gitignore` es un reflejo de cómo manejas tu código. Si está lleno de basura que no tiene que ver con el proyecto, algo anda mal.

Configurá tu `.gitignore` global hoy. Llevate la basura personal fuera del repositorio. Tu equipo te lo va a agradecer.

Y la próxima vez que alguien haga un PR para agregar `.DS_Store` al gitignore... **mandales este artículo.**
