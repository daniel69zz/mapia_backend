# Mapia Backend

Backend de **Mapia**, mapa social ciudadano geolocalizado (La Paz, Bolivia).

**Stack:** NestJS 11 · TypeScript · PostgreSQL + **PostGIS** · TypeORM · JWT (argon2) · Swagger.
**Arquitectura:** monolito modular (Feature First + Clean Architecture ligera).
La cercanía se calcula en el backend con **PostGIS** (`ST_DWithin`), no con Google Maps.

---

## Requisitos

- **Node.js 22+**
- Una cuenta de **Supabase** (Postgres + PostGIS gestionado, free tier) — es la base de datos del proyecto.
- _(Opcional)_ PostgreSQL 17 + PostGIS local, solo si prefieres no usar Supabase en dev.

---

## Puesta en marcha

La base de datos vive **siempre en Supabase** (dev y prod). No necesitas instalar
PostgreSQL ni PostGIS en tu máquina.

### Paso 1 — Base de datos en Supabase

1. Crea un proyecto en https://supabase.com y define una **Database Password**.
2. Activa PostGIS: `Dashboard → Database → Extensions` → habilita **postgis**
   (y `uuid-ossp`, `pgcrypto`).
3. Crea el esquema: `Dashboard → SQL Editor → New query`, pega el contenido de
   [`db/supabase-schema.sql`](db/supabase-schema.sql) y ejecútalo. Es idempotente
   y crea todas las tablas (incluidas las de la IA de visión), índices GIST y seeds.
4. Copia la cadena de conexión: `Connect → Session pooler` (modo *Session*, puerto 5432).

Detalle paso a paso en [`docs/free-tier.md`](docs/free-tier.md).

### Paso 2 — App

```bash
cp .env.example .env        # completa el bloque Supabase (host, user, password)
npm install
npm run seed                # idiomas (opcional; el SQL ya los siembra)
npm run start:dev
```

> En Supabase **no se corren migraciones TypeORM** (`DB_RUN_MIGRATIONS=false`):
> el esquema lo gobierna `db/supabase-schema.sql`.

### Alternativa — PostgreSQL local (sin Docker)

Solo si prefieres una base local en vez de Supabase. Requiere PostgreSQL 17 con
PostGIS; hay un script que lo prepara (se auto-eleva con UAC):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-local-db.ps1
```

Instala PostGIS si falta y ejecuta `db/bootstrap.sql` (rol `mapia_user`, base
`mapia_db`, extensiones). Luego, en `.env` descomenta el bloque local y corre las
migraciones:

```bash
npm run migration:run      # crea tablas, índice GIST y trigger de location
npm run seed
npm run start:dev
```

### URLs

| Recurso | URL |
|---|---|
| API | `http://localhost:3000/api/v1` |
| Swagger (docs) | `http://localhost:3000/docs` |
| Healthcheck | `http://localhost:3000/api/v1/health` |
| Archivos locales (dev) | `http://localhost:3000/static/...` |

El `/health` devuelve la versión de PostGIS: útil para confirmar que la base quedó bien.

---

## Conectar tu app (frontend) al backend desplegado

El backend está desplegado en un VPS y accesible públicamente. Tu app debe apuntar a:

| Recurso | URL |
|---|---|
| **Base de la API** | `http://144.22.43.169:3001/api/v1` |
| Swagger (docs) | `http://144.22.43.169:3001/docs` |
| Healthcheck | `http://144.22.43.169:3001/api/v1/health` |

### Configuración en el frontend

Define la URL base en una variable de entorno de tu app (no la hardcodees). Ejemplos:

```bash
# React / Vite        (.env)
VITE_API_BASE_URL=http://144.22.43.169:3001/api/v1

# Next.js             (.env.local)
NEXT_PUBLIC_API_BASE_URL=http://144.22.43.169:3001/api/v1

# Expo / React Native (.env)
EXPO_PUBLIC_API_BASE_URL=http://144.22.43.169:3001/api/v1

# Flutter             (--dart-define o config)
API_BASE_URL=http://144.22.43.169:3001/api/v1
```

Y úsala en tu cliente HTTP:

```ts
const API = import.meta.env.VITE_API_BASE_URL; // o process.env.NEXT_PUBLIC_API_BASE_URL

// Login
const res = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const data = await res.json();
const accessToken = data.tokens.accessToken;   // el token está en tokens.accessToken

// Llamadas protegidas
await fetch(`${API}/profiles/me`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

### Notas importantes

- **El JWT va en `tokens.accessToken`** de la respuesta de login/register (no en la raíz). Caduca a los 15 min; renueva con `POST /auth/refresh` enviando el `tokens.refreshToken`.
- **CORS** ya acepta cualquier origen (`CORS_ORIGINS=*`), así que tu app puede llamar desde cualquier dominio en desarrollo.
- **⚠️ HTTP vs HTTPS (Mixed Content):** la API se sirve por **`http://`** (sin TLS). Si tu frontend está servido por **`https://`**, el navegador **bloqueará** las llamadas por seguridad. Mientras la API no tenga HTTPS, sirve tu frontend también por `http://`. Para producción, pon la API detrás de un dominio con TLS (reverse proxy Nginx/Caddy → contenedor en `3001`) y usa esa URL `https://` como base.

---

## Variables de entorno

Copiar `.env.example` a `.env`. Claves principales:

| Variable | Default (dev) | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `API_PREFIX` | `api/v1` | Prefijo global |
| `CORS_ORIGINS` | `*` | Orígenes permitidos (coma-separados) |
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | Conexión PostgreSQL |
| `DB_USERNAME` / `DB_PASSWORD` | `mapia_user` / `mapia_password` | Credenciales app |
| `DB_DATABASE` | `mapia_db` | Base de datos |
| `DB_SSL` | `false` | SSL (true si IP pública en cloud) |
| `DB_RUN_MIGRATIONS` | `true` | Correr migraciones al arrancar |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `change_me_*` | Secretos JWT (cambiar) |
| `STORAGE_DRIVER` | `local` | `local` (disco) o `gcs` (prod) |
| `DEFAULT_RADIUS_KM` / `MAX_RADIUS_KM` | `3` / `50` | Radio por defecto y tope |
| `GOOGLE_MAPS_API_KEY` | _(vacío)_ | Sin key → geocoding responde **mock** |

> Nunca commitear el `.env`. En producción los secretos van en **Secret Manager**.

---

## Comandos útiles

```bash
npm run start:dev                 # API en watch
npm run build                     # compilar a dist/
npm run migration:run             # aplicar migraciones pendientes
npm run migration:revert          # revertir la última
npm run migration:generate src/core/database/migrations/NombreMigracion
npm run seed                      # semillas (idiomas)
```

---

## Estructura

```
src/
├── main.ts                # bootstrap (helmet, cors, swagger, static)
├── app.module.ts          # wiring + guards/filtros/pipes globales
├── core/                  # infraestructura transversal
│   ├── config/  env/      # configuración tipada + validación (Joi)
│   ├── database/          # TypeORM datasource + migraciones + seeds
│   ├── security/          # argon2 (PasswordService)
│   └── storage/           # puerto storage: local (dev) / gcs (prod)
├── common/                # decorators, dtos, guards, filters, enums, utils
└── modules/               # features
    ├── auth/ users/ profiles/ settings/ languages/
    ├── posts/ post-media/ comments/ reactions/
    ├── map/ alerts/ locations/
    └── health/
```

---

## Endpoints principales (MVP)

| Área | Endpoints |
|---|---|
| **Auth** | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` |
| **Profiles** | `GET /profiles/me` · `PATCH /profiles/me` · `POST /profiles/me/avatar` · `GET /profiles/:username` |
| **Posts** | `POST /posts` · `GET /posts` · `GET /posts/:id` · `PATCH /posts/:id` · `DELETE /posts/:id` · `GET /posts/user/:userId` |
| **Media** | `POST /posts/:postId/media` · `DELETE /post-media/:mediaId` |
| **Comments** | `POST /posts/:postId/comments` · `GET /posts/:postId/comments` · `DELETE /comments/:id` |
| **Reactions** | `POST /posts/:postId/like` · `DELETE /posts/:postId/like` · `GET /posts/:postId/reactions` |
| **Map** | `GET /map/posts?bbox=...` · `GET /map/posts/nearby?lat&lng&radiusKm` |
| **Alerts** | `GET /alerts/nearby-summary?lat&lng&radiusKm` · `GET /alerts/nearby-posts?lat&lng&type&radiusKm` |
| **Locations** | `GET /locations/reverse?lat&lng` · `GET /locations/search?q` |
| **Settings** | `GET /settings/me` · `PATCH /settings/me` |
| **Languages** | `GET /languages` |

Todo documentado en Swagger (`/docs`). Las rutas de lectura del mapa/posts son públicas;
las de escritura requieren `Authorization: Bearer <accessToken>`.

---

## Storage de archivos

- `STORAGE_DRIVER=local` → guarda en `./uploads` y sirve en `/static` (desarrollo).
- `STORAGE_DRIVER=gcs` → Google Cloud Storage (producción), bucket `GCS_BUCKET_NAME`.

El driver se elige por variable de entorno; el código de los módulos no cambia.

---

## Despliegue (opcional, futuro)

- **Free tier (~$0) — recomendado:** [`docs/free-tier.md`](docs/free-tier.md).
  Base de datos en **Supabase** (Postgres + PostGIS gratis), API en **Cloud Run**
  (escala a 0), media en **Cloud Storage**. En Supabase **no se corren migraciones
  TypeORM**: el esquema se crea ejecutando manualmente
  [`db/supabase-schema.sql`](db/supabase-schema.sql) en el SQL Editor (idempotente,
  incluye las tablas de la IA de visión). En el `.env` deja `DB_SSL=true` y
  `DB_RUN_MIGRATIONS=false`.
- **Google Cloud completo (Cloud SQL):** [`docs/deploy-gcp.md`](docs/deploy-gcp.md).
  ⚠️ Cloud SQL **no** está en el free tier; usar solo si aceptas su costo.

---

## Roadmap por fases

- **MVP (hecho):** auth, users, profiles, posts, post-media, comments, reactions, map, alerts, locations, settings, languages.
- **Fase 2:** follows, notifications, moderation, reports.
- **Fase 3:** news-agent, analytics, admin.
