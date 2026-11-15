# Tunnel HTTPS ngrok → API locale (port 3000 par défaut).
param(
  [int]$Port = 3000,
  [string]$Url = "",
  [switch]$Force
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot ".env"
if (-not $Url -and (Test-Path $envFile)) {
  $match = Select-String -Path $envFile -Pattern '^\s*NGROK_TUNNEL_URL=(.+)\s*$' | Select-Object -First 1
  if ($match) {
    $candidate = $match.Matches[0].Groups[1].Value.Trim().Trim('"').Trim("'")
    if ($candidate) { $Url = $candidate }
  }
}

function Get-NgrokPublicUrls {
  try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 2
    return @($response.tunnels | ForEach-Object { $_.public_url } | Where-Object { $_ })
  } catch {
    return @()
  }
}

$existing = Get-NgrokPublicUrls
if ($existing.Count -gt 0 -and -not $Force) {
  Write-Host "Un tunnel ngrok tourne déjà."
  foreach ($publicUrl in $existing) {
    Write-Host "  URL publique : $publicUrl"
  }
  Write-Host ""
  Write-Host "Interface : http://127.0.0.1:4040"
  Write-Host "Nouveau tunnel : arrete ngrok, puis"
  Write-Host "  npm run tunnel:ngrok -- -Url https://TON-DOMAINE.ngrok-free.dev -Force"
  Write-Host "ou definis NGROK_TUNNEL_URL dans .env"
  exit 0
}

if ($Force) {
  Get-Process -Name ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
}

Write-Host "Tunnel ngrok -> http://localhost:$Port"
if ($Url) {
  Write-Host "Domaine demande : $Url"
  Write-Host ""
  ngrok http $Port --url=$Url
} else {
  Write-Host "Aucun NGROK_TUNNEL_URL : ngrok utilise ta config (ngrok.yml)."
  Write-Host "Pour un autre domaine du compte : tableau de bord ngrok -> Domains, puis -Url ..."
  Write-Host ""
  ngrok http $Port
}

if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Si ERR_NGROK_334 : le domaine est deja utilise (autre PC ou ancien ngrok)."
  Write-Host "Choisis un autre domaine sur https://dashboard.ngrok.com/domains"
  exit $LASTEXITCODE
}
