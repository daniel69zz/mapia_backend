# Despliegue en Google Cloud (Cloud SQL + Cloud Storage)

Dos servicios distintos, no confundir:

- **Cloud SQL for PostgreSQL (+PostGIS)** → la BASE DE DATOS (tablas, posts, geo).
- **Cloud Storage (GCS)** → solo ARCHIVOS (fotos/videos de las publicaciones).

> La migración de la base de datos es **la misma** que en local
> (`src/core/database/migrations/1700000000000-InitialSchema.ts`).
> No se reescribe para la nube; solo cambia a qué instancia conectas.

---

## 1. Base de datos: Cloud SQL for PostgreSQL + PostGIS

### 1.1 Crear la instancia y la base

```bash
# Instancia PostgreSQL 16
gcloud sql instances create mapia-db \
  --database-version=POSTGRES_16 \
  --region=us-central1 \
  --tier=db-custom-1-3840 \
  --storage-type=SSD

# Base de datos y usuario de la app
gcloud sql databases create mapia_db --instance=mapia-db
gcloud sql users create mapia_user --instance=mapia-db --password='UNA_PASSWORD_FUERTE'
```

### 1.2 Activar PostGIS

Cloud SQL **soporta PostGIS** (está en la allowlist de extensiones). Se activa con
`CREATE EXTENSION`, igual que en local. El usuario por defecto de la instancia tiene
el rol `cloudsqlsuperuser`, que permite crear extensiones de la allowlist.

La propia migración hace `CREATE EXTENSION IF NOT EXISTS postgis;`, así que **no hay
paso manual extra** si las migraciones corren con un usuario con ese privilegio.
(Si prefieres dejarlo pre-creado: conéctate y ejecuta `CREATE EXTENSION postgis;`
una vez.)

### 1.3 Correr la migración contra Cloud SQL

**Opción recomendada para la primera vez: desde tu máquina con Cloud SQL Auth Proxy.**

```bash
# 1) Levantar el proxy (cifra la conexión; no expongas IP pública)
cloud-sql-proxy --port 5433 TU_PROYECTO:us-central1:mapia-db

# 2) En otra terminal, apuntar el .env al proxy
#    DB_HOST=127.0.0.1
#    DB_PORT=5433
#    DB_USERNAME=mapia_user
#    DB_PASSWORD=UNA_PASSWORD_FUERTE
#    DB_DATABASE=mapia_db
#    DB_SSL=false           # el proxy ya cifra
#    DB_RUN_MIGRATIONS=false

# 3) Ejecutar migraciones y semillas
npm run migration:run
npm run seed
```

Con esto la base queda **desplegada y migrada** en Cloud SQL.

---

## 2. Conexión de la app en producción (Cloud Run)

`DatabaseModule` ya soporta los tres modos. Elegir por variables de entorno:

### Opción A — Unix socket (más simple en Cloud Run)

```env
DB_HOST=/cloudsql/TU_PROYECTO:us-central1:mapia-db
DB_USERNAME=mapia_user
DB_PASSWORD=...        # desde Secret Manager, NO hardcodear
DB_DATABASE=mapia_db
DB_SSL=false
DB_RUN_MIGRATIONS=false
```

Deploy enlazando la instancia:

```bash
gcloud run deploy mapia-api \
  --source . \
  --region us-central1 \
  --add-cloudsql-instances TU_PROYECTO:us-central1:mapia-db \
  --set-secrets DB_PASSWORD=mapia-db-password:latest \
  --set-env-vars "DB_HOST=/cloudsql/TU_PROYECTO:us-central1:mapia-db,DB_USERNAME=mapia_user,DB_DATABASE=mapia_db,DB_RUN_MIGRATIONS=false,STORAGE_DRIVER=gcs,GCS_BUCKET_NAME=mapia-media"
```

### Opción B — IP privada (preferida a escala)

VPC + Serverless VPC Access Connector, `DB_HOST=<ip-privada>`, `DB_SSL` según red.

> **Migraciones en producción:** no las corras en cada instancia (varias réplicas
> chocan). Deja `DB_RUN_MIGRATIONS=false` en el servicio y corre las migraciones como
> paso de release (Cloud Build / Cloud Run Job dedicado) o vía proxy como en 1.3.

---

## 3. Archivos: Cloud Storage (GCS)

Esto **no es la base de datos** ni necesita migración. Solo un bucket donde la app
sube las fotos/videos (el `IStorageService` con driver `gcs` ya está implementado).

```bash
# Crear el bucket
gcloud storage buckets create gs://mapia-media --location=us-central1

# Dar permiso de escritura a la cuenta de servicio de Cloud Run
gcloud storage buckets add-iam-policy-binding gs://mapia-media \
  --member="serviceAccount:SA_DE_CLOUD_RUN@TU_PROYECTO.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

Variables en el servicio:

```env
STORAGE_DRIVER=gcs
GCS_BUCKET_NAME=mapia-media
GCP_PROJECT_ID=TU_PROYECTO
```

Las credenciales se toman por **Application Default Credentials** (la cuenta de
servicio de Cloud Run); no se sube ningún archivo de llaves al repo.

---

## Resumen mental

```
Cloud SQL  = la base de datos (misma migración PostGIS de siempre)
Cloud Storage (GCS) = solo los archivos, sin migración
Secret Manager = contraseñas/llaves (nunca en el código)
Cloud Run = la API (NestJS) conectada a ambos
```
