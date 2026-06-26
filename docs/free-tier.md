# Mapia en Free Tier (costo ~$0)

Objetivo: mantener todo el proyecto dentro de planes gratuitos.

> **Regla de oro:** NO usar **Cloud SQL** (no tiene plan gratuito). La base de datos
> va en **Supabase** (Postgres gestionado con PostGIS, free tier). El resto encaja en
> el *Always Free* de Google Cloud.

## Arquitectura gratuita

```
API NestJS    → Cloud Run (escala a 0)              $0  (2M req/mes)
Base de datos → Supabase Postgres + PostGIS          $0  (free tier)
Media         → Cloud Storage (us-central1)          $0  (≤5 GB)
Secretos      → Secret Manager                        $0  (≤6 versiones)
Geocoding     → Maps con caché + mock                ~$0  (uso mínimo)
```

---

## 1. Base de datos: Supabase (con PostGIS)

### 1.1 Crear el proyecto
1. Entra a https://supabase.com → **New project**.
2. Elige región cercana (p. ej. `South America (São Paulo)` o la que prefieras),
   define una **Database Password** (guárdala).

### 1.2 Activar PostGIS
- Dashboard → **Database → Extensions** → busca **postgis** → **Enable**.
- (o por SQL en el SQL Editor: `create extension if not exists postgis;`)

### 1.3 Obtener la cadena de conexión correcta
Dashboard → **Connect** (botón arriba) → pestaña **Session pooler** (modo *Session*).
Usa esos datos (NO el "Transaction pooler" 6543: el modo *Session* en el puerto 5432
es el compatible con TypeORM).

Pon en tu `.env`:

```env
DB_HOST=aws-0-<region>.pooler.supabase.com
DB_PORT=5432
DB_USERNAME=postgres.<project-ref>
DB_PASSWORD=<tu-db-password>
DB_DATABASE=postgres
DB_SSL=true
DB_RUN_MIGRATIONS=false     # en Supabase el esquema se crea manualmente (ver 1.4)
STORAGE_DRIVER=local        # o gcs en producción
```

> `DB_SSL=true` ya está soportado por `DatabaseModule`/`data-source.ts`
> (usa `ssl: { rejectUnauthorized: false }`).

### 1.4 Crear el esquema en Supabase (manual, una sola vez)

En Supabase **no se corren migraciones TypeORM**. El esquema se crea ejecutando
**un único archivo SQL** en el editor:

1. Abre `Dashboard -> SQL Editor -> New query`.
2. Pega el contenido de [`db/supabase-schema.sql`](../db/supabase-schema.sql) y ejecútalo.

Crea todas las tablas (incluidos `reports`, `report_ai_analysis` y `moderation_logs`
de la IA de visión), los índices GIST, el trigger de `location` de `posts` y siembra
los idiomas. Es **idempotente** (se puede repetir sin error) y deja registradas las
migraciones para que la app nunca intente recrear el esquema.

Mantén `DB_RUN_MIGRATIONS=false` en el `.env`.

> Las migraciones de `src/core/database/migrations/` son **solo para el desarrollo
> local** con PostgreSQL nativo; no se usan contra Supabase.

> Si el SQL Editor no deja crear las extensiones, habilítalas antes en
> `Dashboard -> Database -> Extensions` (busca `postgis`, `uuid-ossp` y `pgcrypto`)
> y vuelve a ejecutar.

### 1.5 Probar
```bash
npm run start:dev
# GET http://localhost:3000/api/v1/health  -> debe mostrar la versión de PostGIS
```

---

## 2. API: Cloud Run (escala a 0)

```bash
gcloud run deploy mapia-api \
  --source . \
  --region us-central1 \
  --min-instances=0 \
  --max-instances=2 \
  --set-secrets DB_PASSWORD=mapia-db-password:latest \
  --set-env-vars "DB_HOST=aws-0-<region>.pooler.supabase.com,DB_PORT=5432,DB_USERNAME=postgres.<ref>,DB_DATABASE=postgres,DB_SSL=true,DB_RUN_MIGRATIONS=false,STORAGE_DRIVER=gcs,GCS_BUCKET_NAME=mapia-media"
```

- `--min-instances=0` → sin costo en reposo (clave para free tier).
- `--max-instances=2` → limita conexiones a Supabase y evita sorpresas.
- No usar conector VPC (cobra) — no hace falta con Supabase.

---

## 3. Media: Cloud Storage (región free)

```bash
gcloud storage buckets create gs://mapia-media --location=us-central1
```

- Solo regiones free: `us-central1`, `us-east1`, `us-west1`.
- Sin *versioning* para no acumular almacenamiento.
- Permiso a la cuenta de servicio de Cloud Run: rol `roles/storage.objectAdmin` en el bucket.

---

## 4. Maps Platform (geocoding/places)

- El módulo `locations` **cachea 24 h** y cae a **mock** sin API key → consumo casi nulo.
- Si activas la key: restringe la API key a **Geocoding API** + **Places API** y por IP/referer.
- Cada API tiene cuota mensual gratuita; con el caché difícilmente la superes en un MVP.

---

## 5. Control de costos (imprescindible)

- **Budget alert:** `Billing → Budgets & alerts` → presupuesto de USD 1 con avisos al 50/90/100%.
- Revisa que **no** haya instancias de Cloud SQL ni conectores VPC creados.
- Cloud Run siempre con `min-instances=0`.

---

## Resumen

| Componente | Servicio | Costo |
|---|---|---|
| Base de datos + PostGIS | **Supabase** (Session pooler, `DB_SSL=true`) | $0 |
| API | Cloud Run (`min-instances=0`) | $0 |
| Media | Cloud Storage (`us-central1`) | $0 |
| Secretos | Secret Manager | $0 |
| Geocoding | Maps + caché/mock | ~$0 |

El código no cambia entre local, Supabase y producción: todo se controla por `.env`.
