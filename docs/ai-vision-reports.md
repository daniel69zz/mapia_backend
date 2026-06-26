# MAPIA — Reportes ciudadanos con análisis de imágenes por IA

> Arquitectura para subir una foto desde Flutter, analizarla con un modelo multimodal
> (Gemini), clasificarla en una categoría y guardarla como **reporte geolocalizado** en
> PostgreSQL/PostGIS.
>
> Documento de diseño orientado a implementación real para MVP de hackathon, pensado para
> escalar después.

---

## 0. Cómo encaja con lo que YA existe en el repo (leer primero)

Este diseño **extiende** el código actual, no lo reemplaza. Decisiones de reconciliación:

| Tema | Estado actual en el repo | Decisión para esta feature |
|------|--------------------------|----------------------------|
| Tabla de reportes | `reports` (`AlertReport`) enfocada en abastecimiento (`stock_bajo`, `sobreprecio`, `combustible`…) con `confidence`, `status='active'`, `latitude/longitude` | **Reutilizar la misma tabla** `reports`. Añadir columna `category` (las 8 categorías nuevas), `status` con workflow ampliado y `location geography(Point,4326)`. `alertType` queda como subtipo opcional del vertical de abastecimiento. |
| "IA" actual | `parseCitizenReport()` es **heurística regex**, no IA real (`reports.service.ts`) | Nuevo `AiVisionService` (Gemini multimodal real). La heurística se mantiene como **fallback** si la API falla. |
| Imágenes | `AlertReportImage` + subida **multipart al backend** (`storage.upload(buffer)`) | Mantener multipart para dev/MVP. Añadir **signed URLs** (GCS) para prod. Nueva tabla `report_ai_analysis` para la respuesta cruda del modelo. |
| Storage | `IStorageService { upload, delete }`, drivers `local` + `supabase`/`gcs`, símbolo `STORAGE_SERVICE` | Añadir `createSignedUploadUrl()` a la interfaz. Driver GCS la implementa; local devuelve fallback multipart. |
| IA y costo | Memoria del proyecto: **"todo en free tier (~$0)"** | **Vertex AI NO tiene free tier.** Usar **Google AI Studio (Gemini API)** con `gemini-2.0-flash` para el MVP (free tier con rate limits) detrás de una interfaz, para migrar a Vertex AI sin tocar el resto. |

Convenciones del repo a respetar en el código nuevo:
- Path aliases: `@core/*`, `@modules/*`, `@common/*`.
- Entidades extienden `BaseEntity` (uuid `id`, `created_at`, `updated_at` timestamptz).
- Inyección de storage por token: `@Inject(STORAGE_SERVICE)`.
- Validación con `class-validator` + DTOs con `@ApiProperty`.
- Migraciones TypeORM en `src/core/database/migrations`.

---

## 1. Arquitectura general del sistema

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              FLUTTER (móvil)                                    │
│  - Toma/elige foto + captura GPS (lat/lng del dispositivo, NUNCA del modelo)    │
│  - Comprime imagen (<= ~1.5 MB, lado largo ~1280px)                             │
│  - Muestra estado: analizando → sugerencia IA → usuario confirma/edita         │
└───────────┬───────────────────────────────────────────────┬────────────────────┘
            │ (1) POST /reports/upload-url  [JWT]            │ (5) GET /reports/nearby
            │ (3) POST /reports/analyze-photo               │     (mapa)
            │ (4) POST /reports                              │
            ▼                                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         NESTJS API  (Cloud Run, min-instances=0)               │
│  Auth JWT ─ Throttler ─ Validation                                             │
│                                                                                │
│   ReportsModule ── StorageModule ── AiVisionModule ── ModerationModule         │
│        │               │                  │                  │                 │
│        │       signed URL / upload   prompt+imagen      reglas confianza        │
│        ▼               ▼                  ▼                  ▼                 │
└────────┼───────────────┼──────────────────┼──────────────────────────────────┘
         │               │                  │
         │       (2) PUT imagen        (3b) analyze
         │        (signed URL)              │
         ▼               ▼                  ▼
┌─────────────────┐ ┌──────────────────┐ ┌────────────────────────────────────┐
│  Cloud SQL /    │ │ Cloud Storage    │ │  Gemini multimodal                  │
│  Supabase       │ │ (bucket privado) │ │  MVP: AI Studio gemini-2.0-flash    │
│  Postgres+PostGIS│ │  reports/{id}/  │ │  Prod: Vertex AI gemini-1.5/2.x     │
│  - reports      │ │                  │ │  (+ opcional Cloud Vision OCR/labels)│
│  - report_images│ │                  │ └────────────────────────────────────┘
│  - report_ai_*  │ └──────────────────┘
│  - moderation_* │
└─────────────────┘
```

**Quién habla con quién**
- **Flutter ↔ NestJS**: REST + JWT. Flutter nunca llama a Vertex/Vision directo (la API key vive en el backend).
- **Flutter ↔ Cloud Storage**: solo con **signed URL** emitida por NestJS (PUT directo, no pasa por Cloud Run → ahorra CPU/egress).
- **NestJS ↔ Gemini**: el backend descarga la imagen del bucket (o usa la URL/GCS URI) y la manda al modelo con el prompt. La respuesta JSON se valida y se guarda.
- **NestJS ↔ Cloud Vision** (opcional): OCR de carteles/precios, labels y `landmarkDetection` para reforzar la categoría antes/después de Gemini.
- **NestJS ↔ Postgres/PostGIS**: persistencia + consultas de cercanía con `ST_DWithin` sobre `location geography(Point,4326)` e índice GIST.

---

## 2. Flujo completo paso a paso

1. **Usuario elige foto** en Flutter. La app captura la geolocalización **del dispositivo** (GPS), comprime la imagen y valida tamaño/tipo localmente.
2. **`POST /reports/upload-url`** → NestJS valida JWT, genera un `objectKey` (`reports/{userId}/{uuid}.jpg`) y devuelve una **signed URL** de subida (PUT, 5 min, content-type fijado).
3. **Flutter sube la imagen** con `PUT` a la signed URL (directo a GCS). *(En dev/MVP sin signed URL: `multipart` a `POST /reports/analyze-photo`.)*
4. **`POST /reports/analyze-photo`** con `{ objectKey, latitude, longitude }`:
   - NestJS verifica que el objeto existe y que el `objectKey` pertenece al usuario.
   - (Opcional) Cloud Vision: OCR + labels para pistas.
   - Llama a **Gemini** con el prompt + imagen.
   - Valida el JSON (categoría, título, descripción, tags, confidence…).
   - Guarda un registro en estado **`pending_review`** o **`analyzed`** + fila en `report_ai_analysis` con la respuesta cruda.
   - Devuelve la sugerencia al usuario (no publica todavía).
5. **Usuario confirma/edita** la sugerencia en Flutter.
6. **`POST /reports`** (o `PATCH /reports/:id/confirm`): NestJS aplica **reglas de confianza** + valida que `lat/lng` estén dentro de Bolivia, fija `status` final (`published` o `pending_review`), calcula `location` con PostGIS y persiste.
7. **Moderación**: si `confidence < umbral` o `requires_review`, el reporte queda `pending_review` y aparece en la cola de moderadores; si no, `published`.
8. **Mapa**: `GET /reports/nearby?lat&lng&radius` devuelve los `published` cercanos vía `ST_DWithin`.

> Regla de oro: **la ubicación SIEMPRE viene del dispositivo del usuario, nunca del modelo.** El prompt prohíbe inventar ubicación.

---

## 3. Estructura de módulos en NestJS

```
src/
├─ core/
│  ├─ storage/                 # YA existe — añadir createSignedUploadUrl()
│  │   ├─ storage.types.ts     # + método signed URL en IStorageService
│  │   ├─ gcs-storage.service.ts
│  │   └─ local-storage.service.ts
│  └─ ai/                       # NUEVO — cliente IA agnóstico de proveedor
│      ├─ ai.module.ts
│      ├─ ai.types.ts           # IImageAnalyzer, AiImageAnalysis
│      ├─ gemini-aistudio.service.ts   # MVP free tier
│      ├─ vertex-gemini.service.ts     # prod (mismo interfaz)
│      └─ prompts/citizen-report.prompt.ts
│
├─ modules/
│  ├─ reports/                  # YA existe — extender
│  │   ├─ entities/
│  │   │   ├─ alert-report.entity.ts        # tabla reports (+ category, +location, +status enum)
│  │   │   ├─ alert-report-image.entity.ts  # report_images
│  │   │   ├─ report-ai-analysis.entity.ts  # NUEVO
│  │   │   └─ moderation-log.entity.ts      # NUEVO
│  │   ├─ dto/
│  │   │   ├─ create-upload-url.dto.ts       # NUEVO
│  │   │   ├─ analyze-photo.dto.ts           # NUEVO
│  │   │   ├─ create-report.dto.ts
│  │   │   ├─ confirm-report.dto.ts          # NUEVO
│  │   │   └─ nearby-reports.dto.ts          # NUEVO
│  │   ├─ reports.service.ts
│  │   ├─ ai-vision.service.ts               # NUEVO — orquesta storage+ai+reglas
│  │   ├─ moderation.service.ts              # NUEVO — reglas de confianza + logs
│  │   ├─ reports.controller.ts
│  │   └─ reports.module.ts
│  ├─ auth/        # YA existe (JWT)
│  ├─ users/       # YA existe
│  └─ map/         # YA existe (cercanía PostGIS)
└─ common/         # BaseEntity, paginación, guards, etc.
```

> `report_categories` se modela como **enum + tabla de catálogo** (ver §4) para poder
> mostrar labels/iconos en Flutter sin hardcodear.

---

## 4. Diseño de base de datos

Usar `geography(Point,4326)` (no solo lat/lng sueltos) para cercanía real con PostGIS.
La tabla `reports` ya existe; aquí van las columnas a **añadir** + tablas nuevas.

```sql
-- Extensión (ya la usa el proyecto)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ─────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────
CREATE TYPE report_category AS ENUM (
  'bloqueo', 'corte_servicio', 'fiesta_evento', 'venta',
  'problema_vial', 'atractivo_turistico', 'restaurante', 'otro'
);

CREATE TYPE report_status AS ENUM (
  'draft', 'pending_analysis', 'analyzed',
  'pending_review', 'published', 'rejected'
);

-- ─────────────────────────────────────────────────────────────
-- USERS  (ya existe; referencia)
-- ─────────────────────────────────────────────────────────────
-- id uuid PK, email, username, password_hash (argon2), role, created_at, updated_at

-- ─────────────────────────────────────────────────────────────
-- REPORTS  (tabla existente AlertReport — columnas nuevas marcadas [+])
-- ─────────────────────────────────────────────────────────────
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS user_id   uuid REFERENCES users(id) ON DELETE SET NULL,  -- [+]
  ADD COLUMN IF NOT EXISTS category  report_category,                               -- [+]
  ADD COLUMN IF NOT EXISTS location  geography(Point, 4326),                        -- [+]
  ADD COLUMN IF NOT EXISTS tags      text[] DEFAULT '{}';                           -- [+]

-- status pasa de text libre a enum controlado (migración con USING)
ALTER TABLE reports
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE report_status USING (
    CASE status WHEN 'active' THEN 'published'::report_status
                ELSE 'pending_review'::report_status END
  ),
  ALTER COLUMN status SET DEFAULT 'pending_analysis';

-- Rellenar location desde lat/lng existentes y futuras (trigger o en código)
UPDATE reports SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE location IS NULL AND longitude IS NOT NULL;

-- Índice espacial (clave para /nearby)
CREATE INDEX IF NOT EXISTS idx_reports_location_gist ON reports USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_reports_category      ON reports (category);
CREATE INDEX IF NOT EXISTS idx_reports_status        ON reports (status);

-- Campos relevantes que la tabla ya tiene: id, title, description, alert_type,
-- severity, latitude, longitude, department, municipality, zone, price,
-- source_text, confidence, status, created_at, updated_at

-- ─────────────────────────────────────────────────────────────
-- REPORT_IMAGES  (tabla existente AlertReportImage)
-- ─────────────────────────────────────────────────────────────
-- id uuid PK, report_id FK, url text, path/storage_key text, created_at
-- [+] width, height, bytes, mime_type, checksum (opcional)

-- ─────────────────────────────────────────────────────────────
-- REPORT_AI_ANALYSIS  (NUEVO — una fila por llamada al modelo)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE report_ai_analysis (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     uuid REFERENCES reports(id) ON DELETE CASCADE,
  image_id      uuid REFERENCES report_images(id) ON DELETE SET NULL,
  provider      text NOT NULL,                 -- 'gemini-aistudio' | 'vertex' | 'vision'
  model         text NOT NULL,                 -- 'gemini-2.0-flash'
  category      report_category,
  title         text,
  description   text,
  confidence    numeric(4,3),                  -- 0.000..1.000
  tags          text[] DEFAULT '{}',
  requires_review boolean DEFAULT false,
  detected_text text,                          -- OCR / texto del cartel
  safety_notes  text,
  raw_response  jsonb NOT NULL,                -- respuesta CRUDA del modelo (auditoría)
  latency_ms    integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_analysis_report ON report_ai_analysis (report_id);

-- ─────────────────────────────────────────────────────────────
-- REPORT_CATEGORIES  (NUEVO — catálogo para UI; el enum manda en integridad)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE report_categories (
  code        report_category PRIMARY KEY,
  label_es    text NOT NULL,
  icon        text,
  color       text,
  is_active   boolean DEFAULT true,
  sort_order  int DEFAULT 0
);
INSERT INTO report_categories (code, label_es, icon, color, sort_order) VALUES
 ('bloqueo','Bloqueo','block','#E53935',1),
 ('corte_servicio','Corte de servicio','power_off','#FB8C00',2),
 ('fiesta_evento','Fiesta / Evento','celebration','#8E24AA',3),
 ('venta','Venta','sell','#43A047',4),
 ('problema_vial','Problema vial','warning','#FDD835',5),
 ('atractivo_turistico','Atractivo turístico','landscape','#00ACC1',6),
 ('restaurante','Restaurante / Lugar','restaurant','#6D4C41',7),
 ('otro','Otro','more_horiz','#757575',8);

-- ─────────────────────────────────────────────────────────────
-- MODERATION_LOGS  (NUEVO)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE moderation_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id    uuid REFERENCES reports(id) ON DELETE CASCADE,
  actor_id     uuid REFERENCES users(id),     -- null = sistema (regla automática)
  action       text NOT NULL,                 -- 'auto_publish'|'sent_to_review'|'approved'|'rejected'|'edited'
  from_status  report_status,
  to_status    report_status,
  reason       text,
  metadata     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_moderation_report ON moderation_logs (report_id);
```

---

## 5. Estados del reporte

| Estado | Cuándo se usa |
|--------|---------------|
| `draft` | El usuario empezó pero aún no subió imagen / no envió. Opcional para MVP. |
| `pending_analysis` | Imagen subida, esperando que la IA la analice (útil si se procesa en cola/async). |
| `analyzed` | La IA respondió; hay sugerencia de categoría/título pero el usuario aún no confirma. |
| `pending_review` | Confianza baja o `requires_review=true`, o usuario reportado: necesita moderador humano. |
| `published` | Visible en el mapa (`GET /reports/nearby`). Confianza alta y/o confirmado por usuario/moderador. |
| `rejected` | Moderador lo descartó (spam, falso, contenido inseguro). No se borra: queda para auditoría. |

Transiciones válidas:
```
draft → pending_analysis → analyzed → (published | pending_review)
pending_review → (published | rejected)
analyzed → rejected            (usuario cancela / contenido inseguro)
```
Cada transición escribe una fila en `moderation_logs`.

---

## 6. Prompt para Gemini

`src/core/ai/prompts/citizen-report.prompt.ts`:

```ts
export const CITIZEN_REPORT_SYSTEM = `
Eres un clasificador de reportes ciudadanos para MAPIA, una app de mapa social en Bolivia
(La Paz, El Alto, Santa Cruz, Cochabamba, Oruro, etc.).
Analizas UNA imagen enviada por un usuario y la clasificas en EXACTAMENTE una categoría.

Reglas estrictas:
- Responde SOLO con un objeto JSON válido. Nada de texto antes o después, sin markdown, sin \`\`\`.
- NO inventes la ubicación. No deduzcas ciudad/zona/coordenadas. La ubicación la pone la app.
- NO asumas cosas que no se ven claramente en la imagen. Si dudas, baja "confidence".
- Si la imagen es ambigua, no clasificable, o no corresponde a ninguna categoría clara,
  usa "category": "otro" y "requires_review": true.
- Si ves texto (carteles, precios, nombres), transcríbelo en "detected_text".
- Si la imagen es insegura, ofensiva, contiene personas identificables de forma sensible,
  violencia o desnudez, descríbelo brevemente en "safety_notes" y pon "requires_review": true.
- "confidence" es un número entre 0.0 y 1.0 que refleja qué tan seguro estás de la categoría.

Categorías permitidas (usa el código exacto):
- "bloqueo": manifestaciones, marchas, vías cerradas con piedras/llantas/vehículos.
- "corte_servicio": cortes de agua, luz, gas, internet (postes/medidores/avisos).
- "fiesta_evento": fiestas, ferias, entradas folclóricas, conciertos, eventos.
- "venta": comercio informal/formal, puestos, productos en venta, mercados.
- "problema_vial": baches, semáforos dañados, accidentes, señalización, obras.
- "atractivo_turistico": paisajes, miradores, monumentos, sitios turísticos.
- "restaurante": restaurantes, cafés, locales de comida, su fachada/interior.
- "otro": cualquier cosa que no encaje claramente arriba.

Devuelve EXACTAMENTE esta estructura:
{
  "category": "bloqueo | corte_servicio | fiesta_evento | venta | problema_vial | atractivo_turistico | restaurante | otro",
  "title": "string corto y descriptivo en español (max 80 chars)",
  "description": "string 1-3 frases, solo lo que se ve",
  "confidence": 0.0,
  "tags": ["string"],
  "requires_review": true,
  "detected_text": "string | null",
  "safety_notes": "string | null"
}
`.trim();

export const CITIZEN_REPORT_USER = `
Clasifica esta imagen según las reglas. Responde SOLO el JSON.
`.trim();
```

> Refuerzo anti-alucinación: además del prompt, en código se fuerza `responseMimeType:
> "application/json"` (y, en Vertex, un `responseSchema`), y se valida el JSON contra un DTO.

---

## 7. Reglas de confianza

`moderation.service.ts`:

```ts
export type Decision = 'auto_publish' | 'ask_confirmation' | 'force_review';

export function decideByConfidence(a: { confidence: number; requiresReview: boolean; category: string }): Decision {
  if (a.requiresReview || a.category === 'otro') return 'force_review';
  if (a.confidence >= 0.85) return 'auto_publish';      // listo para publicar
  if (a.confidence >= 0.60) return 'ask_confirmation';  // el usuario confirma/edita
  return 'force_review';                                // < 0.60: nunca auto-reporte
}
```

| Confianza | Acción | Estado resultante |
|-----------|--------|-------------------|
| `>= 0.85` y no requiresReview | Auto-publicar (o "listo para publicar" si quieres confirmación siempre) | `published` |
| `0.60 – 0.84` | Pedir confirmación al usuario; si confirma → publica, si no → revisión | `analyzed` → `published`/`pending_review` |
| `< 0.60` o `requires_review` o `category=otro` | Nunca auto-publica; a cola de moderación | `pending_review` |

Ajustes finos recomendados:
- Penalizar confianza si Cloud Vision SafeSearch marca `LIKELY/VERY_LIKELY`.
- Subir umbral para categorías sensibles (`bloqueo`, `problema_vial`) porque un falso positivo desinforma.
- Rate-limit por usuario para reportes auto-publicados.

---

## 8. Endpoints REST

Todos bajo JWT salvo lectura pública del mapa. Prefijo `/reports`.

### `POST /reports/upload-url`
Genera signed URL para subir la imagen directo a GCS.
```jsonc
// req
{ "fileName": "foto.jpg", "contentType": "image/jpeg", "bytes": 845123 }
// res 201
{
  "uploadUrl": "https://storage.googleapis.com/mapia-uploads/...&X-Goog-Signature=...",
  "objectKey": "reports/9f1c.../1a2b3c.jpg",
  "expiresIn": 300,
  "method": "PUT",
  "headers": { "Content-Type": "image/jpeg" }
}
```

### `POST /reports/analyze-photo`
Analiza la imagen ya subida y devuelve la sugerencia (NO publica).
```jsonc
// req
{ "objectKey": "reports/9f1c.../1a2b3c.jpg", "latitude": -16.5000, "longitude": -68.1500 }
// res 200
{
  "reportId": "b2d...",            // creado en estado analyzed/pending_review
  "status": "analyzed",
  "decision": "ask_confirmation",
  "analysis": {
    "category": "bloqueo",
    "title": "Vía bloqueada con llantas en El Prado",
    "description": "Manifestantes cierran la calzada con llantas y piedras.",
    "confidence": 0.78,
    "tags": ["bloqueo","manifestacion","via_cerrada"],
    "requiresReview": false,
    "detectedText": "PASO CERRADO",
    "safetyNotes": null
  }
}
```

### `POST /reports`
Crea/confirma el reporte definitivo (cuando no usas el flujo en 2 pasos, o tras editar).
```jsonc
// req
{
  "objectKey": "reports/9f1c.../1a2b3c.jpg",
  "category": "bloqueo",
  "title": "Vía bloqueada en El Prado",
  "description": "Cierre con llantas y piedras.",
  "tags": ["bloqueo","manifestacion"],
  "latitude": -16.5000, "longitude": -68.1500,
  "aiAnalysisId": "a77..."         // opcional, enlaza la sugerencia usada
}
// res 201
{ "id": "b2d...", "status": "published", "location": { "lat": -16.5, "lng": -68.15 } }
```

### `GET /reports/nearby?lat=-16.5&lng=-68.15&radius=1500&category=bloqueo`
Reportes `published` cercanos (PostGIS `ST_DWithin`).
```jsonc
// res 200
{
  "items": [
    { "id":"b2d...","category":"bloqueo","title":"...","latitude":-16.5,"longitude":-68.15,
      "distanceMeters":120,"confidence":0.78,"createdAt":"2026-06-26T14:00:00Z" }
  ],
  "count": 1
}
```

### `PATCH /reports/:id/confirm`
El usuario confirma/edita la sugerencia → publica.
```jsonc
// req
{ "category":"bloqueo", "title":"...", "description":"...", "tags":["..."] }
// res 200
{ "id":"b2d...", "status":"published" }
```

### `PATCH /reports/:id/reject`
Usuario cancela o moderador descarta.
```jsonc
// req { "reason": "no es un bloqueo, es tráfico normal" }
// res 200 { "id":"b2d...", "status":"rejected" }
```

### `GET /reports/:id`
Detalle (incluye imágenes y, para dueño/moderador, el análisis IA).

---

## 9. Seguridad

- **Subida de imágenes**: signed URLs de **corta duración** (5 min), con `contentType` y, si el driver lo permite, `x-goog-content-length-range` fijados. El `objectKey` lo genera el backend e incluye el `userId` → el cliente no elige rutas arbitrarias.
- **Permisos del bucket**: bucket **privado** (Uniform bucket-level access, sin acceso público). Lectura para mostrar imágenes vía signed URL de lectura o vía un endpoint proxy/`GET /reports/:id`. La service account de Cloud Run con rol mínimo (`Storage Object Admin` solo en ese bucket).
- **Validación tamaño/tipo**: en Flutter (UX) **y** en backend (autoridad): MIME en `['image/jpeg','image/png','image/webp']`, tamaño máx (p.ej. 5 MB), y verificación de **magic bytes** (no confiar en la extensión). El repo ya valida MIME y máx 3 imágenes en `createCitizenReport`.
- **Autenticación JWT**: ya implementada (Passport JWT). `analyze-photo`, `create`, `confirm`, `reject` requieren JWT; `nearby` puede ser público o con auth opcional.
- **Abuso de usuarios / reportes falsos**:
  - `@nestjs/throttler` (ya instalado) por usuario/IP en `upload-url` y `analyze-photo` (la IA cuesta).
  - Validar `lat/lng` dentro de **Bolivia** (ya existe `assertInsideBolivia` con bounds).
  - Anti-duplicado: rechazar reportes idénticos del mismo usuario en radio/tiempo corto (checksum de imagen + `ST_DWithin`).
  - Reputación: usuarios nuevos → siempre `pending_review`; usuarios confiables → auto-publican.
- **Moderación**: `pending_review` como cola; `moderation_logs` para trazabilidad; SafeSearch de Cloud Vision para bloquear contenido inseguro antes de Gemini.
- **Secretos**: API key de Gemini / credenciales GCS en **Secret Manager** (memoria del proyecto), nunca en el repo ni en el cliente.

---

## 10. Costos y free tier

| Servicio | Free / barato | Notas |
|----------|---------------|-------|
| **Cloud Storage** | Always Free: 5 GB-region (us-central1/us-east1/us-west1) | Suficiente para MVP. Cuidar egress; servir miniaturas. |
| **Cloud Run** | Always Free generoso (req/CPU/mem mensuales) | `min-instances=0` (memoria del proyecto). Signed URLs evitan que las imágenes pasen por Cloud Run. |
| **Base de datos** | **Cloud SQL NO tiene free tier** → usar **Supabase** (decisión del proyecto) | Postgres + PostGIS gestionado, free tier. |
| **Cloud Vision** | 1.000 unidades/mes gratis por feature | OCR/labels opcional; cuidar al pasar de 1k. |
| **Gemini (IA)** | **Vertex AI NO tiene free tier.** **Google AI Studio (Gemini API)** SÍ, con rate limits | **Para MVP usar AI Studio `gemini-2.0-flash`** (key gratis, límites RPM/día). Migrar a Vertex AI en prod por cuotas/SLA/region. |

**Estrategia económica MVP (~$0):**
1. Gemini **Flash** vía AI Studio (no Pro, no Vertex) — rápido y dentro de free tier.
2. Cloud Vision **solo si hace falta** (OCR de precios); empezar sin él.
3. Comprimir imágenes en Flutter antes de subir (menos storage, menos tokens de visión, análisis más rápido).
4. `min-instances=0` en Cloud Run.
5. Supabase para DB.
6. Cachear/limitar análisis: 1 análisis por imagen; throttle por usuario.

> Aclaración honesta: **nada de esto es gratis para siempre.** Los free tiers tienen límites
> mensuales y los de IA tienen rate limits estrictos. Para una demo de hackathon alcanza;
> para producción hay que presupuestar Gemini/Vertex y Vision.

---

## 11. Estrategia MVP (versión mínima que funciona)

Para el hackathon, **simplifica**: salta signed URLs y la cola async.

1. Flutter: foto + GPS, comprime, `multipart` → `POST /reports/analyze-photo` (la imagen pasa por el backend; reutiliza el patrón `multer` que ya tienes en `createCitizenReport`).
2. Backend: guarda en GCS/local con `storage.upload(buffer)` (ya existe).
3. Backend: llama a **Gemini Flash (AI Studio)** con la imagen → JSON.
4. Valida JSON, aplica reglas de confianza, guarda `reports` + `report_ai_analysis`.
5. Si `confidence >= 0.85` → `published`; si no → `analyzed`/`pending_review`; devuelve sugerencia.
6. Flutter muestra la sugerencia; usuario confirma → `PATCH /reports/:id/confirm`.
7. Mapa: `GET /reports/nearby` (ya tienes PostGIS en `map`).
8. Moderación: una lista simple de `pending_review` para un admin.

Lo que **dejas para fase 2**: signed URLs, colas (Cloud Tasks/Pub-Sub), Cloud Vision, reputación de usuarios, migración a Vertex AI.

---

## 12. Código base

### 12.1 Interfaz de storage — añadir signed URL
`src/core/storage/storage.types.ts` (extender lo existente):
```ts
export interface CreateSignedUploadInput {
  objectKey: string;
  contentType: string;
  expiresInSeconds?: number;   // default 300
}
export interface SignedUploadResult {
  uploadUrl: string;
  objectKey: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresIn: number;
}

export interface IStorageService {
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;
  delete(storageKey: string): Promise<void>;
  // NUEVO:
  createSignedUploadUrl(input: CreateSignedUploadInput): Promise<SignedUploadResult>;
  getBuffer(objectKey: string): Promise<{ buffer: Buffer; contentType: string }>;
}
```

### 12.2 Signed URL en GCS
`src/core/storage/gcs-storage.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { IStorageService, CreateSignedUploadInput, SignedUploadResult /* ... */ } from './storage.types';

@Injectable()
export class GcsStorageService implements IStorageService {
  private readonly storage = new Storage();
  private readonly bucketName = this.config.getOrThrow<string>('GCS_BUCKET');
  constructor(private readonly config: ConfigService) {}

  async createSignedUploadUrl(input: CreateSignedUploadInput): Promise<SignedUploadResult> {
    const expiresIn = input.expiresInSeconds ?? 300;
    const [uploadUrl] = await this.storage
      .bucket(this.bucketName)
      .file(input.objectKey)
      .getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + expiresIn * 1000,
        contentType: input.contentType,
      });
    return {
      uploadUrl,
      objectKey: input.objectKey,
      method: 'PUT',
      headers: { 'Content-Type': input.contentType },
      expiresIn,
    };
  }

  async getBuffer(objectKey: string) {
    const file = this.storage.bucket(this.bucketName).file(objectKey);
    const [meta] = await file.getMetadata();
    const [buffer] = await file.download();
    return { buffer, contentType: meta.contentType ?? 'application/octet-stream' };
  }
  // upload(), delete() — ya existentes
}
```

### 12.3 Cliente Gemini (AI Studio, free tier) + validación de JSON
`src/core/ai/ai.types.ts`:
```ts
export const IMAGE_ANALYZER = Symbol('IMAGE_ANALYZER');

export interface AiImageAnalysis {
  category: 'bloqueo'|'corte_servicio'|'fiesta_evento'|'venta'|'problema_vial'|'atractivo_turistico'|'restaurante'|'otro';
  title: string;
  description: string;
  confidence: number;
  tags: string[];
  requiresReview: boolean;
  detectedText: string | null;
  safetyNotes: string | null;
  raw: unknown;        // respuesta cruda para auditoría
  model: string;
  provider: string;
  latencyMs: number;
}

export interface IImageAnalyzer {
  analyzeImage(input: { buffer: Buffer; mimeType: string }): Promise<AiImageAnalysis>;
}
```

`src/core/ai/gemini-aistudio.service.ts` (REST, sin SDK extra):
```ts
import { Injectable, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IImageAnalyzer, AiImageAnalysis } from './ai.types';
import { CITIZEN_REPORT_SYSTEM, CITIZEN_REPORT_USER } from './prompts/citizen-report.prompt';

const ALLOWED = ['bloqueo','corte_servicio','fiesta_evento','venta','problema_vial','atractivo_turistico','restaurante','otro'];

@Injectable()
export class GeminiAiStudioService implements IImageAnalyzer {
  private readonly model = 'gemini-2.0-flash';
  private readonly apiKey = this.config.getOrThrow<string>('GEMINI_API_KEY');
  constructor(private readonly config: ConfigService) {}

  async analyzeImage({ buffer, mimeType }: { buffer: Buffer; mimeType: string }): Promise<AiImageAnalysis> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const body = {
      systemInstruction: { parts: [{ text: CITIZEN_REPORT_SYSTEM }] },
      contents: [{
        role: 'user',
        parts: [
          { text: CITIZEN_REPORT_USER },
          { inlineData: { mimeType, data: buffer.toString('base64') } },
        ],
      }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    };

    const started = Date.now();
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new BadGatewayException(`Gemini error ${res.status}: ${await res.text()}`);
    const json: any = await res.json();
    const latencyMs = Date.now() - started;

    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const parsed = this.parseAndValidate(text);

    return { ...parsed, raw: json, model: this.model, provider: 'gemini-aistudio', latencyMs };
  }

  /** Tolerante a ```json y basura alrededor; valida campos. */
  private parseAndValidate(text: string) {
    const clean = text.replace(/```json|```/g, '').trim();
    const start = clean.indexOf('{'); const end = clean.lastIndexOf('}');
    let obj: any;
    try { obj = JSON.parse(clean.slice(start, end + 1)); }
    catch { return this.fallback('JSON inválido del modelo'); }

    const category = ALLOWED.includes(obj.category) ? obj.category : 'otro';
    const confidence = clamp01(Number(obj.confidence));
    const requiresReview = Boolean(obj.requires_review) || category === 'otro' || confidence < 0.6;

    return {
      category,
      title: String(obj.title ?? 'Reporte ciudadano').slice(0, 120),
      description: String(obj.description ?? '').slice(0, 1000),
      confidence,
      tags: Array.isArray(obj.tags) ? obj.tags.map(String).slice(0, 10) : [],
      requiresReview,
      detectedText: obj.detected_text ? String(obj.detected_text) : null,
      safetyNotes: obj.safety_notes ? String(obj.safety_notes) : null,
    };
  }

  private fallback(note: string) {
    return { category: 'otro' as const, title: 'Reporte sin clasificar', description: '',
      confidence: 0, tags: [], requiresReview: true, detectedText: null, safetyNotes: note };
  }
}

function clamp01(n: number) { return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0; }
```

> Para migrar a **Vertex AI** después: misma interfaz `IImageAnalyzer`, otra clase
> `VertexGeminiService` que use `aiplatform`/REST con `responseSchema`. Se cambia el provider
> en `ai.module.ts` por env; el resto del código no se entera.

### 12.4 Orquestación: analizar y persistir (TypeORM)
`src/modules/reports/ai-vision.service.ts`:
```ts
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { STORAGE_SERVICE, IStorageService } from '@core/storage/storage.types';
import { IMAGE_ANALYZER, IImageAnalyzer } from '@core/ai/ai.types';
import { AlertReport } from './entities/alert-report.entity';
import { ReportAiAnalysis } from './entities/report-ai-analysis.entity';
import { decideByConfidence } from './moderation.service';

@Injectable()
export class AiVisionService {
  constructor(
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
    @Inject(IMAGE_ANALYZER) private readonly analyzer: IImageAnalyzer,
    @InjectRepository(AlertReport) private readonly reports: Repository<AlertReport>,
    @InjectRepository(ReportAiAnalysis) private readonly aiRepo: Repository<ReportAiAnalysis>,
  ) {}

  async analyzePhoto(userId: string, objectKey: string, lat: number, lng: number) {
    const { buffer, contentType } = await this.storage.getBuffer(objectKey);
    const ai = await this.analyzer.analyzeImage({ buffer, mimeType: contentType });
    const decision = decideByConfidence({ confidence: ai.confidence, requiresReview: ai.requiresReview, category: ai.category });

    const status = decision === 'auto_publish' ? 'published'
                 : decision === 'ask_confirmation' ? 'analyzed' : 'pending_review';

    // location con PostGIS via raw value (geography)
    const report = this.reports.create({
      // @ts-expect-error columnas nuevas: user_id, category, tags, location
      userId,
      category: ai.category,
      title: ai.title,
      description: ai.description,
      tags: ai.tags,
      latitude: lat,
      longitude: lng,
      confidence: String(ai.confidence),
      status,
    });
    const saved = await this.reports.save(report);

    // setear geography por SQL (TypeORM no mapea geography directo)
    await this.reports.query(
      `UPDATE reports SET location = ST_SetSRID(ST_MakePoint($1,$2),4326) WHERE id = $3`,
      [lng, lat, saved.id],
    );

    await this.aiRepo.save(this.aiRepo.create({
      reportId: saved.id, provider: ai.provider, model: ai.model,
      category: ai.category, title: ai.title, description: ai.description,
      confidence: String(ai.confidence), tags: ai.tags, requiresReview: ai.requiresReview,
      detectedText: ai.detectedText, safetyNotes: ai.safetyNotes,
      rawResponse: ai.raw, latencyMs: ai.latencyMs,
    }));

    return { reportId: saved.id, status, decision, analysis: ai };
  }
}
```

### 12.5 Cercanía con PostGIS
`reports.service.ts` (nuevo método):
```ts
async findNearby(lat: number, lng: number, radius = 1500, category?: string) {
  const rows = await this.alertReportRepo.query(
    `SELECT id, category, title, latitude, longitude, confidence, created_at,
            ST_Distance(location, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography) AS distance_meters
       FROM reports
      WHERE status = 'published'
        AND ($4::report_category IS NULL OR category = $4)
        AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, $3)
      ORDER BY distance_meters ASC
      LIMIT 100`,
    [lng, lat, radius, category ?? null],
  );
  return { items: rows, count: rows.length };
}
```

### 12.6 Controlador
```ts
@Post('upload-url')
@UseGuards(JwtAuthGuard)
createUploadUrl(@CurrentUser() user, @Body() dto: CreateUploadUrlDto) {
  const objectKey = `reports/${user.id}/${randomUUID()}.${extFromMime(dto.contentType)}`;
  return this.storage.createSignedUploadUrl({ objectKey, contentType: dto.contentType });
}

@Post('analyze-photo')
@UseGuards(JwtAuthGuard)
analyze(@CurrentUser() user, @Body() dto: AnalyzePhotoDto) {
  return this.aiVision.analyzePhoto(user.id, dto.objectKey, dto.latitude, dto.longitude);
}

@Get('nearby')
nearby(@Query() q: NearbyReportsDto) {
  return this.reports.findNearby(q.lat, q.lng, q.radius, q.category);
}
```

---

## 13. Buenas prácticas

- **Evitar falsos positivos**: `temperature` baja (0.1–0.3), `responseMimeType: application/json`, validar contra DTO, y nunca auto-publicar con `confidence < 0.85`. Subir umbral en categorías sensibles.
- **Mejorar clasificación**: combinar señales — Cloud Vision (labels/landmark/OCR) como pistas en el prompt; few-shot con ejemplos bolivianos; permitir que el usuario corrija y guardar esas correcciones como dataset para evaluación.
- **Logs**: registrar `provider`, `model`, `latencyMs`, `confidence`, decisión y `report_id`. No loguear la API key. Métricas: tasa de `pending_review`, tasa de corrección del usuario por categoría.
- **Guardar respuesta cruda**: `report_ai_analysis.raw_response` (jsonb) siempre — auditoría, depuración de prompt y reentrenamiento futuro.
- **Corrección humana**: `analyzed`/`pending_review` + `moderation_logs`. Toda edición del usuario o moderador queda registrada (from/to status, actor, reason).
- **Colas si tarda**: para escala, mover el análisis a **Cloud Tasks / Pub-Sub**: `analyze-photo` solo crea el reporte en `pending_analysis` y encola; un worker lo procesa y actualiza vía estado. Flutter hace polling o recibe push. (En MVP: síncrono está bien si Flash responde en ~1–3 s.)
- **No bloquear la app**: el análisis es asíncrono desde la UX. Flutter muestra "Analizando…" y deja al usuario seguir; cuando llega la sugerencia, la presenta para confirmar. La subida directa por signed URL no ocupa el backend.
- **Idempotencia y costo**: 1 análisis por imagen (checksum); throttle por usuario; comprimir antes de subir; cachear categorías/labels.
- **Privacidad**: avisar que las fotos se procesan con IA; difuminar rostros/placas si la categoría no los requiere; SafeSearch para contenido inseguro.

---

### Resumen de implementación incremental
1. Migración: enums + columnas (`category`, `location`, `tags`, `user_id`, `status` enum) + tablas `report_ai_analysis`, `report_categories`, `moderation_logs`.
2. `core/ai` (`IImageAnalyzer` + `GeminiAiStudioService` + prompt).
3. `IStorageService.getBuffer` (mínimo para MVP; `createSignedUploadUrl` para fase 2).
4. `AiVisionService` + `moderation.service` (reglas de confianza).
5. Endpoints `analyze-photo`, `nearby`, `confirm`, `reject` (+ `upload-url` en fase 2).
6. `GEMINI_API_KEY` y `GCS_BUCKET` en Secret Manager / `.env`.
```
