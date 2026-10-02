$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

Start-Process powershell -WindowStyle Hidden -WorkingDirectory $root -ArgumentList @(
  "-NoExit",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  "npm.cmd run backend:dev"
)

Start-Process powershell -WindowStyle Hidden -WorkingDirectory $root -ArgumentList @(
  "-NoExit",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  "npm.cmd run frontend:dev"
)

Write-Host "Backend:  http://localhost:3000"
Write-Host "Swagger:  http://localhost:3000/api/docs"
Write-Host "Frontend: http://localhost:5173"
