# Resets local PostgreSQL 16 password to "postgres" and creates the "ecommerce" database.
# Run PowerShell AS ADMINISTRATOR from backend/:  .\scripts\setup-local-postgres.ps1

$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "ERROR: Run PowerShell as Administrator (required to restart PostgreSQL)." -ForegroundColor Red
  Write-Host "If you already ran this script once, use: .\scripts\finish-postgres-setup.ps1"
  exit 1
}

$pgData = "C:\Program Files\PostgreSQL\16\data"
$pgHba = Join-Path $pgData "pg_hba.conf"
$pgBin = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
$serviceName = "postgresql-x64-16"
$newPassword = "postgres"
$dbName = "ecommerce"

if (-not (Test-Path $pgHba)) {
  Write-Error "pg_hba.conf not found at $pgHba. Adjust paths in this script for your PostgreSQL version."
}

$backup = "$pgHba.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $pgHba $backup
Write-Host "Backed up pg_hba.conf to $backup"

$content = Get-Content $pgHba -Raw
$content = $content -replace "127\.0\.0\.1/32\s+scram-sha-256", "127.0.0.1/32            trust"
$content = $content -replace "::1/128\s+scram-sha-256", "::1/128                 trust"
Set-Content -Path $pgHba -Value $content -NoNewline

Write-Host "Restarting PostgreSQL service..."
Restart-Service $serviceName -Force
Start-Sleep -Seconds 3

$env:PGPASSWORD = ""
& $pgBin -U postgres -h localhost -d postgres -c "ALTER USER postgres WITH PASSWORD '$newPassword';"
& $pgBin -U postgres -h localhost -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$dbName'" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "psql failed connecting with trust auth" }

$exists = & $pgBin -U postgres -h localhost -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$dbName'"
if ($exists -ne "1") {
  & $pgBin -U postgres -h localhost -d postgres -c "CREATE DATABASE $dbName;"
  Write-Host "Created database '$dbName'"
} else {
  Write-Host "Database '$dbName' already exists"
}

Write-Host "Restoring pg_hba.conf security..."
Copy-Item $backup $pgHba -Force
Restart-Service $serviceName -Force
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Done. DATABASE_URL should be:"
Write-Host "postgresql://postgres:$newPassword@localhost:5432/$dbName"
Write-Host ""
Write-Host "Next: npx prisma db push && npm run seed"
