# GamingTrends API (NestJS / TypeScript)

Migración moderna, modular y compatible del API `Backend` (.NET / C#) a **NestJS**, **Node.js 24** y **Azure SQL Database / Microsoft SQL Server**.

La documentación OpenAPI interactiva (Swagger) se encuentra disponible en `/docs`.

---

## 1. Arquitectura y Descomposición Modular

La solución adopta una arquitectura desacoplada y orientada al dominio (*Domain-Driven*), estructurada en módulos independientes de NestJS:

- **`auth`**: Autenticación mediante JSON Web Tokens (JWT), guardias de seguridad (`JwtGuard`), decorador `@CurrentUser` y hashing de credenciales compatible con el algoritmo PBKDF2/SHA del Backend .NET legacy.
- **`users`**: Administración de usuarios, ciclo de vida de cuentas, verificación de contraseñas y actualización segura.
- **`games`**: Catálogo de videojuegos, paginación, búsqueda avanzada, relaciones con géneros y cálculo ponderado de calificaciones (*likes* / *dislikes*).
- **`developers` & `developer-users`**: Gestión de estudios y desarrolladores, vinculación de roles de usuario y permisos de desarrollo.
- **`user-games`**: Biblioteca personal de videojuegos por usuario, verificación de posesión y listado de juegos adquiridos.
- **`genres`, `roles`, `media`, `social-links`**: Dominios complementarios para categorización, control de accesos, contenido multimedia y enlaces sociales.
- **`mail`**: Abstracción del servicio de correo electrónico (`MailService`) con implementación en memoria (`StubMailService`) y plantillas HTML integradas.
- **`health`**: Endpoints de salud y disponibilidad para orquestadores y balanceadores.
- **`store`**: Capa de abstracción de datos relacionales (`DataStore`) y mapeo de esquema.
- **`config`**: Configuración centralizada y tipada (`AppConfig`) respaldada por `@nestjs/config`.

### Capa de Abstracción `DataStore`

Para desacoplar la lógica de negocio de la base de datos física, la persistencia se gestiona a través del contrato abstracto `DataStore`:

- **`SqlDataStore`**: Implementación de producción basada en el driver nativo `mssql`. Gestiona un pool de conexiones con inicialización perezosa (*lazy loading*) y concurrencia segura (*concurrency-safe*). La aplicación no abre sockets de red ni valida credenciales hasta ejecutar la primera consulta que requiera SQL.
- **`InMemoryDataStore`**: Motor de almacenamiento relacional en memoria que emula transacciones, filtros `WHERE`, joins, límites y ordenamiento. Permite ejecutar suites de pruebas unitarias y de integración end-to-end de forma ultrarrápida, determinista y sin dependencias externas.

### Compatibilidad de Protocolo y DTOs

- **Normalización de claves**: El filtro global `KeyNormalizePipe` convierte recursivamente atributos en notación `PascalCase` (heredados de clientes .NET / C#) a `camelCase`, manteniendo interoperabilidad bidireccional sin romper contratos existentes.
- **Reglas de validación**: Configurado con `ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true })`. Los campos no permitidos o no declarados se ignoran silenciosamente en lugar de rechazar la solicitud, garantizando compatibilidad con clientes existentes que envían metadatos complementarios.
- **Códigos HTTP de respuesta**: Para preservar compatibilidad absoluta con clientes legacy de frontend y librerías C# que esperan `200 OK`, **todos los endpoints `POST`** implementan la anotación `@HttpCode(200)` (en lugar del código por defecto `201 Created`).

---

## 2. Seguridad y Mitigación de Inyección SQL

La aplicación implementa controles defensivos en cada capa de procesamiento:

1. **Parámetros Bind Sanitizados**: Todas las consultas ejecutadas por `SqlDataStore` (`select`, `count`, `insert`, `update`, `delete`, `query`) emplean exclusivamente parámetros preparados (`request.input(nombre, tipo, valor)`). No existe interpolación de texto sin procesar ni concatenación dinámica de cadenas para cláusulas `WHERE` o valores de escritura.
2. **Protección de `orderBy` contra el Esquema**: El parámetro de ordenamiento se valida contra las columnas declaradas en la definición de esquema estático (`SCHEMA[table].columns`). Si se proporciona un campo inexistente o malicioso, el sistema descarta la entrada del usuario y utiliza por defecto la clave primaria de la tabla (`pk[0]`), neutralizando vectores de inyección SQL basados en ordenamiento.
3. **Mapeo Tipado de Tipos SQL**: Cada columna se tipa según el esquema (`Int`, `Bit`, `DateTime2`, `Decimal`, `NVarChar`), evitando conversiones de tipo inseguras.
4. **Cabeceras HTTP y Protección**: Integración de `helmet` para mitigación de ataques comunes (XSS, Clickjacking, MIME-sniffing) y configuración centralizada de CORS.

---

## 3. Endpoints de Salud y Monitoreo

La API expone sondeos estándar para orquestación de contenedores (Kubernetes / Docker):

- **`GET /health`** (Liveness Probe):
  - Verifica que el proceso HTTP de Node.js se encuentre activo y respondiendo a solicitudes.
  - Utilizado por la instrucción `HEALTHCHECK` del Dockerfile.
  - Respuesta: `{ "status": "ok" }` con código `200`.

- **`GET /health/ready`** (Readiness Probe):
  - Verifica la conectividad real con la base de datos ejecutando `DataStore.ping()`.
  - Si el almacenamiento responde, retorna `{ "status": "ok", "info": { "database": { "status": "up" } } }` con HTTP `200`.
  - Si la base de datos no está disponible, retorna `{ "status": "error", "error": { "database": { "status": "down" } } }` con código `503 Service Unavailable`.

---

## 4. Servicio de Correo Electrónico (`MailService`)

La arquitectura incluye un subsistema de mensajería desacoplado:

- **Contrato `MailService`**: Define las operaciones para envío de verificación de cuenta (`sendVerificationEmail`) y restablecimiento de contraseña (`sendPasswordResetEmail`).
- **Implementación `StubMailService`**: Proveedor por defecto que almacena los correos en una bandeja de salida en memoria (`outbox`), generando el contenido HTML correspondiente a través de las plantillas del módulo `templates.ts`.
- **Extensibilidad**: Diseñado para conectarse directamente a proveedores de producción como **SendGrid**, **Amazon SES** o **SMTP/Nodemailer** mediante inyección de dependencias, sin alterar los controladores ni servicios de usuario.

---

## 5. Configuración del Entorno

Copiar la plantilla de variables de entorno y configurar los valores correspondientes:

```bash
cp .env.example .env
```

El archivo `.env` está excluido de control de versiones (`.gitignore`). La aplicación requiere las siguientes variables en producción:

| Variable | Descripción | Ejemplo / Valor por defecto |
| :--- | :--- | :--- |
| `PORT` | Puerto de escucha del servidor HTTP | `3000` |
| `API_URL` | URL pública de la API | `http://localhost:3000` |
| `JWT_SECRET` | Clave secreta para firma de tokens JWT | *(Cadena aleatoria >32 caracteres)* |
| `JWT_EXPIRES_IN` | Tiempo de expiración del token | `24h` |
| `ENCRYPTER_KEY` | Clave simétrica para encriptación | *(Cadena hexadecimal / texto)* |
| `DB_SERVER` | Host / servidor de Azure SQL o SQL Server | `localhost` |
| `DB_PORT` | Puerto del servidor SQL | `1433` |
| `DB_NAME` | Nombre de la base de datos | `GamingTrends` |
| `DB_USER` | Usuario de base de datos | `sa` |
| `DB_PASSWORD` | Contraseña de base de datos | `Password123!` |
| `DB_ENCRYPT` | Encriptación TLS de conexión SQL | `true` |
| `DB_TRUST_SERVER_CERTIFICATE` | Confianza en certificado de servidor | `false` |

---

## 6. Desarrollo y Compilación

### Instalación de dependencias

```bash
npm ci
```

### Ejecución en desarrollo

```bash
npm run start:dev
```

### Compilación para producción

La compilación se gestiona mediante `tsconfig.build.json`:

```bash
npm run build
```

El artefacto compilado se genera en `dist/main.js`. El comando de ejecución para entornos de producción es:

```bash
npm start
# Ejecuta: node dist/main.js
```

---

## 7. Pruebas y Cobertura de Código

El proyecto cuenta con un conjunto exhaustivo de pruebas automatizadas ejecutadas con Jest y `ts-jest`:

- **21 suites de prueba** con **198 tests** (100% exitosos).
- **Cobertura de código**:
  - **Líneas**: **> 92%** (92.65%)
  - **Ramas**: **> 88%** (88.23%)
  - **Sentencias**: **> 91%** (91.88%)

### Comandos de verificación

```bash
# Ejecutar todas las pruebas unitarias y de integración
npm test

# Generar reporte detallado de cobertura de código
npm run coverage

# Ejecutar pruebas end-to-end
npm run test:e2e

# Verificación estática de tipos TypeScript
npm run typecheck

# Análisis estático de código con ESLint
npm run lint

# Auditoría de dependencias en producción
npm run audit

# Pipeline local completo
npm run ci
```

---

## 8. Contenedorización (Docker)

El `Dockerfile` utiliza una construcción multi-etapa (*multi-stage build*) basada en **Alpine Linux** (`node:24-alpine`) para minimizar la superficie de ataque y el tamaño de la imagen final:

1. **`deps`**: Instalación completa de dependencias con `npm ci` para resolver el árbol de módulos.
2. **`build`**: Compilación de la aplicación NestJS con `npm run build`.
3. **`prod-deps`**: Instalación limpia de dependencias exclusivas de producción con `npm ci --omit=dev`.
4. **`runtime`**: Entorno final de ejecución:
   - Usuario sin privilegios (`USER node`).
   - Copia de artefactos mínimos (`dist/` y `node_modules/`).
   - Entry point: `CMD ["node", "dist/main.js"]`.
   - **`HEALTHCHECK` integrado**: Monitorea el estado del contenedor cada 30 segundos invocando el endpoint `/health` mediante el cliente `fetch` nativo de Node.js.

### Construcción y ejecución del contenedor

```bash
# Construir la imagen
docker build -t gaming-trends-api .

# Ejecutar el contenedor
docker run -d --name gaming-trends \
  -p 3000:3000 \
  -e PORT=3000 \
  -e JWT_SECRET=tu-clave-secreta-jwt \
  gaming-trends-api
```

---

## 9. Integración Continua (CI / GitHub Actions)

El flujo de trabajo automatizado se define en `.github/workflows/ci.yml` y se ejecuta ante cada `push` a la rama `main` o apertura de un `pull_request`:

1. **Job `quality`**:
   - Configura el entorno en Ubuntu con Node.js 24 y caché de `npm`.
   - Ejecuta `npm run lint` y `npm run typecheck`.
   - Ejecuta `npm run coverage` y almacena el reporte de cobertura como artefacto del pipeline por 7 días.
2. **Job `audit`**:
   - Instala dependencias con `--ignore-scripts` para prevenir ejecución arbitraria.
   - Ejecuta `npm run audit` para descartar vulnerabilidades de severidad alta o crítica en dependencias de producción.
3. **Job `docker`** (*Docker Build & Smoke Test*):
   - Depende del éxito de los jobs `quality` y `audit`.
   - Construye la imagen de producción con Docker Buildx.
   - Despliega un contenedor de prueba efímero.
   - Ejecuta un **Smoke Test** verificando que el servidor responda con éxito en el endpoint `/health`.
   - Recolecta logs y limpia los recursos del contenedor.
