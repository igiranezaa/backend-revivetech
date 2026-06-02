# Run AFTER setup-local-postgres.ps1 failed on restart, OR if pg_hba already has "trust" for 127.0.0.1
# MUST run PowerShell AS ADMINISTRATOR

$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host ""
  Write-Host "ERROR: Run PowerShell as Administrator." -ForegroundColor Red
  Write-Host "  Right-click PowerShell -> Run as administrator"
  Write-Host "  cd D:\KLab\e-commerce\backend"
  Write-Host "  .\scripts\finish-postgres-setup.ps1"
  Write-Host ""
  exit 1
}

$pgData = "C:\Program Files\PostgreSQL\16\data"
$pgHba = Join-Path $pgData "pg_hba.conf"
$pgBin = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
$serviceName = "postgresql-x64-16"
$newPassword = "postgres"
$dbName = "ecommerce"

Write-Host "Reloading PostgreSQL config (restart)..."
Restart-Service $serviceName -Force
Start-Sleep -Seconds 4

Write-Host "Setting postgres password and creating database..."
& $pgBin -U postgres -h 127.0.0.1 -d postgres -c "ALTER USER postgres WITH PASSWORD '$newPassword';"

$exists = & $pgBin -U postgres -h 127.0.0.1 -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$dbName'"
if ($exists -ne "1") {
  & $pgBin -U postgres -h 127.0.0.1 -d postgres -c "CREATE DATABASE $dbName;"
  Write-Host "Created database '$dbName'"
} else {
  Write-Host "Database '$dbName' already exists"
}

# Restore secure auth from latest backup
$backup = Get-ChildItem "$pgHba.backup-*" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($backup) {
  Write-Host "Restoring $($backup.Name)..."
  Copy-Item $backup.FullName $pgHba -Force
} else {
  Write-Host "Reverting trust -> scram-sha-256 in pg_hba.conf..."
  (Get-Content $pgHba) `
    -replace "127\.0\.0\.1/32\s+trust", "127.0.0.1/32            scram-sha-256" `
    -replace "::1/128\s+trust", "::1/128                 scram-sha-256" |
    Set-Content $pgHba
}

Restart-Service $serviceName -Force
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Success. Run in a normal terminal:" -ForegroundColor Green
Write-Host "  cd D:\KLab\e-commerce\backend"
Write-Host "  npx prisma db push"
Write-Host "  npm run seed"
