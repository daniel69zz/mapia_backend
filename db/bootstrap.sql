-- ============================================================
-- Mapia - Bootstrap de PostgreSQL LOCAL (sin Docker)
-- Ejecutar como superusuario "postgres":
--   psql -U postgres -f db/bootstrap.sql
--
-- Idempotente: se puede correr varias veces sin error.
-- Requisito previo: PostGIS instalado en este PostgreSQL
-- (Stack Builder -> Spatial Extensions -> PostGIS).
--
-- NOTA: este archivo es SOLO para LOCAL (crea rol + base + extensiones) y usa
-- meta-comandos de psql (\gexec, \connect). Para SUPABASE usa en cambio
-- db/supabase-schema.sql (esquema completo en SQL plano, sin rol/base).
-- ============================================================

-- 1) Rol de la app. SUPERUSER solo para DESARROLLO local
--    (permite que las migraciones hagan CREATE EXTENSION).
SELECT 'CREATE ROLE mapia_user LOGIN SUPERUSER PASSWORD ''mapia_password'''
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mapia_user')\gexec

-- 2) Base de datos de la app.
SELECT 'CREATE DATABASE mapia_db OWNER mapia_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mapia_db')\gexec

-- 3) Activar extensiones dentro de mapia_db.
\connect mapia_db
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 4) Verificación rápida.
SELECT current_database() AS db, PostGIS_Version() AS postgis;
