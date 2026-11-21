# TP DevOps - Universidad de Palermo
<p align="center">
<img src="assets/logo_up_380x380.jpg?raw=true" alt="Universidad de Palermo">

</p>

Para el Trabajo Práctico de la matera DevOps, prepare una API moderna y modular migrada desde el backend legacy en **.NET / C#** del proyecto GamingTrends, a **NestJS** sobre el runtime de **Node.js 24**, diseñada bajo principios de arquitectura limpia, observabilidad continua e integración/despliegue continuo (CI/CD).

La solución incorpora una **estrategia dual de base de datos**:
- **SQLite Local Embebido**: Permite una ejecución inmediata, "zero-config" y autocontenida con datos pre-sembrados, ideal para desarrollo local, evaluación y pruebas.
- **Azure SQL Server / SQL Server**: Motor relacional utilizado para entornos de producción y nube.

El sistema se encuentra 100% contenedorizado con **Docker** y **Docker Compose**, monitoreado en tiempo real con **New Relic APM**, y gobernado por un pipeline automatizado de **GitHub Actions** que compila, prueba, construye y publica la imagen en **Docker Hub** y orquesta el despliegue automático en **Render**.

> [!NOTE]
> La documentación interactiva OpenAPI / Swagger se encuentra expuesta en el endpoint:
> `/docs` (de la URL correspondiente al despliegue).

---

## 1. Decisiones Arquitectónicas

### 1.1. Migración de .NET C# a NestJS / Node.js 24
La decisión de migrar el backend legacy desde .NET C# hacia **NestJS** y **Node.js 24** se basó en la facilidad de uso de Node y NestJS en los entornos operativos actuales. Ademas el uso de estas nuevas tecnologías facilitaron el cumplimiento de los siguientes pilares de ingeniería:
- **Modularidad Orientada al Dominio (*Domain-Driven Modules*)**: NestJS ofrece una separación estricta de responsabilidades mediante módulos (`auth`, `users`, `games`, `developers`, `genres`, etc.), facilitando el mantenimiento, la escalabilidad y las pruebas unitarias aisladas.
- **Inyección de Dependencias Robusta (IoC / DI)**: Permite desacoplar los servicios de negocio de la infraestructura de persistencia, facilitando el intercambio de motores de base de datos sin alterar los casos de uso.
- **Tipado Estricto con TypeScript**: Mantiene la seguridad de tipos estática que caracterizaba a C#, minimizando errores en tiempo de ejecución.
- **Compatibilidad con Ecosistemas Cloud-Native Modernos**: El runtime Node.js 24 proporciona un inicio rápido (*fast startup*), bajo consumo de memoria y compatibilidad nativa con contenedores Linux ligeros (`node:24-alpine`).

### 1.2. Compatibilidad de Protocolo con el Backend Legacy
Para asegurar una transición transparente para el front sin exigir cambios en el cliente, se implementaron los siguientes mecanismos de compatibilidad:
- **`KeyNormalizePipe` (Normalización Bidireccional de Nomenclatura)**:
  Transforma recursivamente los nombres de propiedades entre `PascalCase` (convención utilizada en .NET / C#) y `camelCase` (convención idiomática de TypeScript / NestJS). Permite que la API reciba peticiones formuladas según los contratos antiguos y procese internamente objetos normalizados.
- **Código HTTP de Respuesta `@HttpCode(200)` en Endpoints `POST`**:
  Mientras NestJS responde por defecto con `201 Created` ante solicitudes `POST`, los clientes HTTP heredados de .NET y librerías cliente esperan un estricto `200 OK`. Se configuró la anotación `@HttpCode(200)` en todos los controladores de creación y mutación para evitar rupturas de contrato.
- **Algoritmo de Hashing de Contraseñas PBKDF2/SHA**:
  Se implementó una rutina criptográfica idéntica a la utilizada por ASP.NET Core Identity (`PBKDF2` con HMAC-SHA256, salt criptográfico de 128 bits e iteraciones calibradas). Esto garantiza que las contraseñas migradas desde la base de datos original sigan siendo plenamente válidas y verificables sin forzar un reseteo masivo de usuarios.
- **Validación Tolerante con `class-validator`**:
  La validación global se configuró con `whitelist: true` y `forbidNonWhitelisted: false`. Esto permite absorber de forma segura cargas útiles con metadatos o campos extras provenientes de versiones anteriores de los clientes sin rechazar la solicitud con errores HTTP 400.

### 1.3. Patrón `DataStore` y Estrategia Multi-Motor
Se desacopló la lógica de acceso a datos mediante el contrato abstracto `DataStore`, permitiendo intercambiar de manera transparente la infraestructura de persistencia:

```mermaid
flowchart TD
    A["DataStore
    (Abstract)"] -->
    B(SqliteDataStore
    better-sqlite3
    data/database)
    A --> C(SqlDataStore
    mssql
    Azure / MSSQL)
    A --> D(InMemoryDataStore
    Pruebas / CI
    198 tests en menos de 5s)
```

1. **`SqliteDataStore` (Persistencia Local Embebida)**:
   - Basado en el driver síncrono `better-sqlite3`.
   - Lee y persiste el archivo local pre-sembrado en `data/database.sqlite3`.
   - Ofrece una experiencia de desarrollo y evaluación inmediata sin necesidad de levantar contenedores adicionales ni configurar bases de datos externas.
2. **`SqlDataStore` (Producción en Nube / Azure SQL)**:
   - Basado en el driver oficial `mssql` con soporte para connection pooling optimizado y reconexión resiliente.
   - Aplica consultas totalmente parametrizadas mediante `request.input()`, garantizando protección total frente a inyecciones SQL.
   - Soporta TLS y cifrado de conexión (`encrypt: true`) para cumplir los estándares de seguridad de Azure Database.
3. **`InMemoryDataStore` (Pruebas Unitarias Aisladas)**:
   - Emula un almacén relacional estructurado en memoria.
   - Permite que los 198 tests unitarios y de integración se ejecuten en pocos segundos en entornos locales y en el flujo de CI, eliminando la latencia de red y dependencias de bases de datos externas.
4. **Selección Dinámica vía Variable de Entorno**:
   - La selección del proveedor se resuelve dinámicamente en `StoreModule` evaluando la variable `DB_TYPE` (`sqlite` o `azure`).

### 1.4. Safeguard y Validación Temprana (`onModuleInit`)
En `StoreModule`, la aplicación implementa el hook del ciclo de vida `OnModuleInit`:
- Al arrancar la aplicación, se ejecuta proactivamente una consulta centinela (`SELECT 1 AS [ok]`).
- Si la conexión falla, se emite inmediatamente un mensaje estructurado y visible en los registros (`Logger.error`), alertando al operador antes de comenzar a servir tráfico HTTP.
- Si la conexión es exitosa, se reporta el estado exacto del motor (`✅ Base de datos SQLite lista en...` o `✅ Base de datos SQL Server conectada en...`).

### 1.5. Documentación Swagger Automatizada
- Integración del plugin `@nestjs/swagger` dentro de `nest-cli.json` con `introspectComments: true` y `classValidatorShim: true`.
- Extrae automáticamente metadatos, tipos y descripciones desde las clases DTO y comentarios de código sin requerir decoradores redundantes en cada propiedad.
- Expone la interfaz gráfica Swagger UI en la ruta `/docs`.

### 1.6. Observabilidad Integrada con New Relic
- El agente de **New Relic APM** se inyecta en tiempo de ejecución (`node -r newrelic dist/main.js`).
- Proporciona instrumentación automática de transacciones HTTP, medición de tiempos de respuesta, tasa de rendimiento (*throughput*), trazabilidad de errores no controlados y análisis de consumo de memoria y CPU.

---

## 2. Pipeline de CI/CD y Diagrama de Flujo

El flujo CI / CD está automatizado mediante GitHub Actions bajo una arquitectura modular basada en **Reusable Workflows (`on: workflow_call`)** dentro de `.github/workflows/`:

- `ci.yml`: Compuerta de calidad (*Quality Gate*) ejecutable de forma independiente en ramas/PRs y reutilizable por CD.
- `cd.yml`: Orquestador principal de liberación y despliegue en `main`.
- `cd-semver.yml`: Módulo de cálculo automático de versiones SemVer, publicación de tags Git (`vX.Y.Z`) y creación automática de GitHub Release con su changelog.
- `cd-docker.yml`: Módulo de compilación multi-etapa y publicación de imágenes en Docker Hub (`:X.Y.Z` y `:latest`).
- `cd-render.yml`: Módulo de despliegue continuo hacia Render apuntando exactamente al tag SemVer publicado.

### Diagrama del Flujo de Trabajo

```mermaid
flowchart TD
    CITrigger["Eventos CI: pull_request en 'main' / push (branches-ignore: 'main', paths-ignore: '**.md', 'assets/**') / workflow_dispatch"] --> CIConc["ci.yml (concurrency: ci-ref, cancel-in-progress: true)"]

    subgraph CIModule ["Módulo CI (.github/workflows/ci.yml - también reusable via workflow_call)"]
        CIConc --> CIEnv["Job quality (Ubuntu Latest, Node.js 24, cache npm) + npm ci"]
        CIEnv --> CILint["npm run lint (ESLint 9)"]
        CILint --> CIType["npm run typecheck (TSC 5.9)"]
        CIType --> CICov["npm run coverage (Jest & ts-jest)"]
        CICov --> CIArtifact["Upload artifact: coverage-report (retención 7 días)"]
    end

    CDTrigger["Eventos CD: push en 'main' (paths-ignore: '**.md', 'assets/**') / workflow_dispatch"] --> CDConc["cd.yml Orquestador (concurrency: cd-ref, cancel-in-progress: true, permissions: contents: write)"]

    subgraph CDOrchestrator ["Pipeline Modular CD (.github/workflows/cd.yml)"]
        CDConc --> JobQuality["1. Quality Gate: reutiliza ci.yml (workflow_call, secrets: inherit)"]
        JobQuality --> MainCheck{"github.ref == 'refs/heads/main'?"}
        MainCheck -->|"No"| StopCD["Fin del flujo CD (sin tag ni despliegue)"]
        MainCheck -->|"Sí"| JobSemver["2. Semantic Versioning: cd-semver.yml (fetch-depth: 0, github-tag-action@v7, tag vX.Y.Z + GitHub Release via release-action@v1)"]
        JobSemver -->|"outputs: version (X.Y.Z), tag (vX.Y.Z)"| JobDocker["3. Docker Build & Push: cd-docker.yml (Docker Hub :X.Y.Z y :latest)"]
        JobSemver -->|"needs.semver.outputs.version (image_tag)"| JobRender["4. Deploy to Render: cd-render.yml (needs: semver y docker, curl --fail-with-body)"]
        JobDocker --> JobRender
    end

    JobRender --> ProdOk["Servicio en Render actualizado con tag SemVer exacto"]
```

### Explicación de Etapas y Compuertas de Calidad

1. **Arquitectura Modular y Reutilización (`workflow_call` + `secrets: inherit`)**:
   - Se separa estrictamente la **Integración Continua (`ci.yml`)** de la **Entrega Continua (`cd.yml`)**.
   - El orquestador `cd.yml` invoca los módulos `ci.yml`, `cd-semver.yml`, `cd-docker.yml` y `cd-render.yml` mediante `workflow_call`, propagando los secretos requeridos con `secrets: inherit` y pasando `needs.semver.outputs.version` directamente como `image_tag` a `cd-docker.yml` y `cd-render.yml`.
2. **Permisos (`permissions`) y Filtros de Rutas (`paths-ignore`)**:
   - `cd.yml` y el job `semver` de `cd-semver.yml` configuran `permissions: contents: write` para crear y publicar el tag Git `vX.Y.Z` y el correspondiente GitHub Release.
   - `ci.yml` (`pull_request` y `push`) y `cd.yml` (`push`) configuran `paths-ignore: ['**.md', 'assets/**']` para omitir ejecuciones automáticas cuando los *commits* solo modifican archivos Markdown o recursos bajo `assets/`.
3. **Grupos de Concurrencia (`concurrency`)**:
   - **CI (`ci-${{ github.ref }}`)**: Configurado con `cancel-in-progress: true` para cancelar ejecuciones obsoletas ante nuevos *commits* en la misma rama o *Pull Request*.
   - **CD (`cd-${{ github.ref }}`)**: Configurado con `cancel-in-progress: true` para cancelar ejecuciones previas en curso sobre la misma referencia.
4. **Etapa 1: Quality Gate (`ci.yml`)**:
   - Se dispara ante `pull_request` hacia `main`, `push` en cualquier rama distinta de `main` (`branches-ignore: [main]`), ejecución manual (`workflow_dispatch`) o como primera compuerta invocada por `cd.yml`.
   - Configura **Node.js 24** (`actions/setup-node@v7`) con caché de `npm`, instala dependencias (`npm ci`), ejecuta `npm run lint`, valida tipado estricto con `npm run typecheck`, corre la suite de pruebas con `npm run coverage` (inyectando `JWT_SECRET` y `ENCRYPTER_KEY`) y publica el directorio `coverage/` como artefacto `coverage-report` con retención de 7 días (`actions/upload-artifact@v7`).
5. **Etapa 2: Semantic Versioning (`cd-semver.yml`)**:
   - Se ejecuta únicamente tras aprobar `quality` y cuando `github.ref == 'refs/heads/main'`.
   - Realiza *checkout* con historial completo (`fetch-depth: 0`) mediante `actions/checkout@v7` y calcula/publica automáticamente la versión siguiendo **Conventional Commits** con `mathieudutour/github-tag-action@v7` (`default_bump: patch`, `tag_prefix: v`, `initial_version: "1.0.0"`, `release_branches: main`):
     - `fix:` -> incremento **patch** (también aplicado como `default_bump: patch` si no hay prefijo convencional).
     - `feat:` -> incremento **minor**.
     - `BREAKING CHANGE` (o `!:` en el encabezado del commit) -> incremento **major**.
   - Cuando se genera un nuevo tag (`steps.tag_version.outputs.new_tag != ''`), crea automáticamente un **GitHub Release** con el changelog generado mediante `ncipollo/release-action@v1`.
   - Expone los *outputs* `version` (`new_version || previous_version`) y `tag` (`new_tag || previous_tag`).
6. **Etapa 3: Docker Build & Push (`cd-docker.yml`)**:
   - Recibe `image_tag: ${{ needs.semver.outputs.version }}` (`needs: semver`).
   - Ejecuta `actions/checkout@v7`, se autentica en Docker Hub (`docker/login-action@v4`) con `DOCKER_USER` y `DOCKER_PASS`, extrae etiquetas OCI (`docker/metadata-action@v6`) y construye/publica la imagen con `docker/build-push-action@v7` bajo dos tags: `${{ secrets.DOCKER_USER }}/aserra14-service:${{ inputs.image_tag }}` y `${{ secrets.DOCKER_USER }}/aserra14-service:latest`.
7. **Etapa 4: Deploy to Render (`cd-render.yml`)**:
   - Se ejecuta tras completarse `semver` y `docker` (`needs: [semver, docker]`), recibiendo `image_tag: ${{ needs.semver.outputs.version }}`.
   - Invoca el *Deploy Hook* de Render mediante `curl --fail-with-body "$deploy_url"` enviando `imgURL=docker.io%2F${{ secrets.DOCKER_USER }}%2Faserra14-service%3A${{ inputs.image_tag }}`.

---

## 3. Herramientas Utilizadas y Evidencia

### Stack Tecnológico

| Categoría | Tecnología / Herramienta | Propósito en el Proyecto |
| :--- | :--- | :--- |
| **Runtime & Lenguaje** | Node.js |  Runtime de ejecución rápido y compatible con estándares modernos. |
| **Lenguaje** | TypeScript |  Tipado estático robusto y detección de errores en tiempo de compilación. |
| **Framework Backend** | NestJS |  Arquitectura modular escalable con inyección de dependencias. |
| **Bases de Datos** | SQLite (`better-sqlite3`) |  Motor relacional embebido para ejecución local "zero-config". |
| **Bases de Datos** | Azure SQL / SQL Server (`mssql`) |  Motor relacional escalable de producción en la nube. |
| **Contenedores** | Docker & Docker Compose |  Empaquetado aislado y reproducible para desarrollo y producción. |
| **CI / CD** | GitHub Actions |  Automatización de compilación, calidad, empaquetado y entrega. |
| **Registry de Imágenes** | Docker Hub |  Almacenamiento seguro y versionado de imágenes de contenedor. |
| **Plataforma Cloud** | Render |  Hospedaje y ejecución del contenedor en infraestructura en la nube. |
| **Observabilidad** | New Relic APM |  Monitoreo en tiempo real de transacciones, latencia y métricas de runtime. |
| **Documentación** | Swagger / OpenAPI |  Documentación viva de contratos y consola interactiva de pruebas. |
| **Testing & Calidad** | Jest, ts-jest, Supertest | Pruebas unitarias, pruebas de integración y cálculo de cobertura (>90%). |
| **Linter & Formato** | ESLint | Reglas estrictas de calidad de código y mejores prácticas TypeScript. |
| **Seguridad HTTP** | Helmet | Configuración segura de cabeceras HTTP contra vulnerabilidades web. |

### Evidencia de Funcionamiento (Capturas de Pantalla)

A continuación se presentan los espacios designados para las evidencias gráficas del correcto funcionamiento de cada componente de la plataforma:

#### 1. Pipeline de CI/CD en GitHub Actions
> Evidencia de la ejecución exitosa de los 4 jobs orquestados por CD en GitHub Actions (`Quality Gate / Quality`, `Semantic Versioning`, `Docker Build & Push`, `Deploy to Render`).
![GitHub Actions](assets/github_actions.png?raw=true "GitHub Actions")


#### 2. Imagen Publicada en Docker Hub
> Evidencia de la imagen publicada en Docker Hub
![Docker Hub](assets/dockerhub.png?raw=true "Docker Hub")

#### 3. Servicio Activo en Render
> Evidencia del servicio activo en Render
![Render](assets/render.png?raw=true "Render")

#### 4. Dashboard de Observabilidad en New Relic APM
> Evidencia del dashboard de New Relic reflejando el rendimiento del servicio, métricas de transacciones y apdex score.
![New Relic](assets/newrelic.png?raw=true "New Relic")



---

## 4. Análisis bajo Principios DevOps y Lean

En este proyecto aplicamos prácticas DevOps y principios Lean con un objetivo claro: que el software se pueda desarrollar, probar y poner en producción de forma automática, confiable y sin depender de tareas manuales repetitivas.

---

### 4.1. Prácticas DevOps aplicadas al proyecto

#### 1. Infraestructura como Código (IaC) y Paridad de Entornos
* **Mismo entorno en todos lados:** Mediante el `Dockerfile` y `docker-compose.yml`, la infraestructura queda definida en código y versionada en el repositorio.
* **Fin del *"en mi máquina funciona"*:** El código se ejecuta exactamente bajo las mismas condiciones en la máquina del desarrollador, en los servidores de GitHub Actions y en la nube (Render). Esto acelera la puesta en producción y evita sorpresas por diferencias de configuración.

#### 2. Pipeline de CI/CD, Quality Gates y el concepto de "Andon Cord"
* **Automatización de punta a punta:** Cada cambio subido a la rama principal pasa por un pipeline automático en GitHub Actions: verifica código -> corre pruebas -> arma la imagen Docker -> la publica en Docker Hub -> notifica a Render para el despliegue.
* **Quality Gates (Compuertas de Calidad):** Antes de generar una imagen o desplegar, el código debe aprobar tres filtros obligatorios: linteo (ESLint), chequeo de tipos estricto (`tsc`) y más del 90% de cobertura en tests.
* **Andon Cord (Parada de línea):** Tomando el principio de manufactura Lean, si un test o validación falla en el pipeline, la ejecución se detiene de inmediato. Ningún código con errores llega a producción ni consume recursos innecesarios.

#### 3. Resiliencia y Observabilidad Proactiva
* **Endpoints de salud (`/health` y `/health/ready`):** Permiten saber si el servicio está vivo y si la base de datos responde. Si algo falla, el orquestador puede reiniciar el contenedor o dejar de enviarle tráfico antes de que afecte a los usuarios.
* **Telemetría con New Relic APM:** Monitorea tiempos de respuesta, errores y consumo en tiempo real. En lugar de esperar a que un usuario avise que el sistema falló, el equipo puede ver las fallas y cuellos de botella al instante desde el dashboard.

#### 4. Responsabilidad Compartida y Git como Fuente Única de Verdad
* **Colaboración sin silos:** El equipo de desarrollo no se desentiende de cómo corre la app en producción. En el mismo repositorio se definen la seguridad HTTP, variables de entorno, Dockerfile y los flujos de CI/CD.
* **Control total de versiones:** Todo cambio de código, infraestructura o despliegue queda registrado en Git, facilitando auditorías, trabajo en equipo y la posibilidad de volver atrás (*rollback*) rápidamente si surge un problema.

---

### 4.2. Principios Lean: Reducción del Desperdicio de Tiempo y Esfuerzo

El pensamiento Lean se enfoca en entregar valor continuo al usuario eliminando cualquier forma de desperdicio (muda). En el desarrollo tradicional, la mayor pérdida de tiempo proviene de tareas manuales repetitivas (configurar servidores a mano, generar imágenes y desplegar por SSH o similares), tiempos muertos de espera y la corrección tardía de errores en producción que obligan a rehacer trabajo.

En este proyecto atacamos ese desperdicio mediante la automatización integral de la entrega y la calidad en origen. El pipeline de CI/CD junto con la infraestructura en código (IaC) convierte la gestión manual en un proceso que compila, prueba y despliega en Render en pocos minutos sin intervención humana. Al mismo tiempo, las compuertas de calidad automáticas detienen los defectos en el momento del commit, y la configuración "Zero-Config" con Docker Compose permite a cualquier desarrollador o evaluador levantar el sistema al instante, eliminando tiempos de espera y permitiendo al equipo enfocarse únicamente en construir valor.

---

### 4.3. Las Tres Vías de DevOps

1. **Flujo rápido (Primera Vía):** Pasamos del código a producción de manera continua y sin fricciones mediante automatización completa.
2. **Feedback continuo (Segunda Vía):** Recibimos avisos inmediatos si algo se rompe, tanto en desarrollo (tests en segundos) como en producción (New Relic y health checks).
3. **Aprendizaje y mejora (Tercera Vía):** Al contar con un entorno seguro y reproducible, es fácil experimentar, refactorizar y mejorar el sistema sin miedo a romperlo.

---

## 5. Guía de Ejecución Local (Zero-Config)

El proyecto está configurado para ejecutarse inmediatamente de forma local sin requerir la instalación previa de servidores de bases de datos.

### Opción A: Ejecución con Docker Compose (Recomendada)

1. Clonar el repositorio y posicionarse en la carpeta raíz:
   ```bash
   cd DevOps_TP
   ```

2. Iniciar el servicio con Docker Compose:
   ```bash
   docker-compose up
   ```

3. El contenedor levantará en modo desarrollo, cargará la base de datos SQLite pre-sembrada (`data/database.sqlite3`) y expondrá el servidor en el puerto `3000`:
   - API: `http://localhost:3000`
   - Swagger UI: `http://localhost:3000/docs`
   - Sonda de Salud: `http://localhost:3000/health`

### Opción B: Ejecución Nativa con Node.js

1. Asegurarse de utilizar **Node.js 24**:
   ```bash
   node -v # >= 24.0.0
   ```

2. Instalar las dependencias del proyecto:
   ```bash
   npm ci
   ```

3. Copiar y configurar las variables de entorno:
   ```bash
   cp .env.example .env
   ```

4. Iniciar en modo desarrollo con recarga en caliente (*watch mode*):
   ```bash
   npm run start:dev
   ```

---

## 6. Endpoints de Salud y Diagnóstico (Health Checks)

La API implementa dos sondas de diagnóstico con `@nestjs/terminus` para su integración con orquestadores de contenedores y plataformas de monitoreo:

### 1. Liveness Probe (`GET /health`)
- **Propósito**: Confirma que el hilo de ejecución principal y el servidor HTTP de Node.js responden adecuadamente.
- **Uso**: Invocado por la instrucción `HEALTHCHECK` del `Dockerfile` cada 30 segundos.
- **Respuesta (200 OK)**:
  ```json
  {
    "status": "ok",
    "info": {},
    "error": {},
    "details": {}
  }
  ```

### 2. Readiness Probe (`GET /health/ready`)
- **Propósito**: Verifica que la aplicación no solo esté viva sino en condiciones de atender tráfico de negocio, evaluando activamente la conectividad con la base de datos subyacente mediante `DataStore.ping()`.
- **Respuesta Saludable (200 OK)**:
  ```json
  {
    "status": "ok",
    "info": {
      "database": {
        "status": "up"
      }
    },
    "error": {},
    "details": {
      "database": {
        "status": "up"
      }
    }
  }
  ```
- **Respuesta con Degradación (503 Service Unavailable)**:
  Retorna código `503` en caso de que la base de datos se encuentre inaccesible, previniendo que los balanceadores de carga enruten tráfico a una instancia no funcional.

---

## 7. Comandos de Pruebas y Aseguramiento de Calidad

El proyecto dispone de scripts estandarizados en `package.json` para validar la estabilidad del sistema:

```bash
# Ejecutar la suite completa de pruebas unitarias y de integración (198 tests)
npm test

# Ejecutar pruebas con cálculo y reporte completo de cobertura de código
npm run coverage

# Ejecutar pruebas end-to-end (E2E)
npm run test:e2e

# Análisis estático de código con ESLint
npm run lint

# Verificación de compilación y tipos con TypeScript
npm run typecheck

# Auditoría de seguridad de dependencias en producción
npm run audit

# Ejecución consolidada del pipeline de calidad local
npm run ci
```
