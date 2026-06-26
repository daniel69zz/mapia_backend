# ============================================================
# Mapia - Setup de base de datos LOCAL (sin Docker)
# Instala PostGIS en PostgreSQL 17 y crea rol/base/extensiones.
#
# Uso (PowerShell):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-local-db.ps1
#
# El script se auto-eleva (UAC) porque instalar PostGIS requiere admin.
# Te pedirá la contraseña del superusuario "postgres" (la que pusiste
# al instalar PostgreSQL) para crear el rol y la base.
# ============================================================

param(
  [string]$PgRoot = 'C:\Program Files\PostgreSQL\17',
  [string]$PostgisVersion = '3.6.2-1'
)

$ErrorActionPreference = 'Stop'

# --- Auto-elevación a administrador ---
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
if (-not $isAdmin) {
  Write-Host 'Solicitando permisos de administrador (UAC)...' -ForegroundColor Yellow
  $scriptPath = $MyInvocation.MyCommand.Path
  Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -NoExit -File `"$scriptPath`" -PgRoot `"$PgRoot`" -PostgisVersion `"$PostgisVersion`""
  return
}

$psql = Join-Path $PgRoot 'bin\psql.exe'
$extDir = Join-Path $PgRoot 'share\extension'
$repoRoot = Split-Path -Parent $PSScriptRoot
$bootstrap = Join-Path $repoRoot 'db\bootstrap.sql'

if (-not (Test-Path $psql)) {
  throw "No se encontró psql en $psql. Ajusta -PgRoot."
}

# --- 1) Instalar PostGIS si falta ---
if (Test-Path (Join-Path $extDir 'postgis.control')) {
  Write-Host 'PostGIS ya está instalado. Omitiendo descarga.' -ForegroundColor Green
} else {
  Write-Host 'PostGIS no encontrado. Descargando bundle...' -ForegroundColor Cyan
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $url = "https://download.osgeo.org/postgis/windows/pg17/postgis-bundle-pg17x64-setup-$PostgisVersion.exe"
  $installer = Join-Path $env:TEMP "postgis-bundle-$PostgisVersion.exe"
  Invoke-WebRequest -Uri $url -OutFile $installer

  Write-Host 'Instalando PostGIS (modo desatendido)...' -ForegroundColor Cyan
  $p = Start-Process -FilePath $installer -ArgumentList '--mode unattended --unattendedmodeui minimal' -Wait -PassThru
  if (-not (Test-Path (Join-Path $extDir 'postgis.control'))) {
    Write-Warning 'La instalación desatendida no dejó postgis.control.'
    Write-Warning "Ejecuta el instalador manualmente (Next->Next->Finish): $installer"
    Write-Warning 'O usa Stack Builder. Luego vuelve a correr este script.'
    throw 'PostGIS no quedó instalado.'
  }
  Write-Host 'PostGIS instalado correctamente.' -ForegroundColor Green
}

# --- 2) Crear rol, base y extensiones (bootstrap.sql) ---
Write-Host ''
Write-Host 'Ahora se creará el rol mapia_user y la base mapia_db.' -ForegroundColor Cyan
$securePass = Read-Host -AsSecureString 'Contraseña del superusuario PostgreSQL (postgres)'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
$plainPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)

try {
  $env:PGPASSWORD = $plainPass
  & $psql -U postgres -h localhost -v ON_ERROR_STOP=1 -f $bootstrap
  if ($LASTEXITCODE -ne 0) { throw "psql falló (código $LASTEXITCODE). ¿Contraseña correcta?" }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

Write-Host ''
Write-Host '====================================================' -ForegroundColor Green
Write-Host ' Base lista: PostGIS activo, rol mapia_user y mapia_db creados.' -ForegroundColor Green
Write-Host ' Siguiente paso (en la carpeta del proyecto):' -ForegroundColor Green
Write-Host '   npm run migration:run' -ForegroundColor Green
Write-Host '   npm run seed' -ForegroundColor Green
Write-Host '   npm run start:dev' -ForegroundColor Green
Write-Host '====================================================' -ForegroundColor Green
