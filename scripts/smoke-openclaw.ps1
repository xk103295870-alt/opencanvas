param(
  [string]$ApiBaseUrl = "http://127.0.0.1:8787"
)

function Invoke-Json {
  param(
    [string]$Method,
    [string]$Url,
    [object]$Body = $null,
    [hashtable]$Headers = $null
  )

  $payload = $null
  if ($null -ne $Body) {
    $payload = $Body | ConvertTo-Json -Depth 8
  }

  return Invoke-RestMethod -Method $Method -Uri $Url -Body $payload -ContentType "application/json" -Headers $Headers
}

Write-Output "Open Canvas API smoke test"
Write-Output "API base: $ApiBaseUrl"

try {
  $health = Invoke-RestMethod -Uri "$ApiBaseUrl/health" -TimeoutSec 2
  if (-not $health.ok) { throw "Health check failed" }
} catch {
  Write-Error "API not reachable. Start it first: npm run api:dev"
  exit 1
}

$login = Invoke-Json -Method "POST" -Url "$ApiBaseUrl/v1/auth/demo-login" -Body @{
  name = "Smoke User"
  email = "smoke@open-canvas.local"
  provider = "demo"
}

if (-not $login.accessToken) {
  Write-Error "No access token returned"
  exit 1
}

$key = Invoke-Json -Method "POST" -Url "$ApiBaseUrl/v1/auth/api-keys" -Headers @{ Authorization = "Bearer $($login.accessToken)" } -Body @{
  name = "Smoke Key"
  scopes = @("canvas:read", "canvas:write")
}

if (-not $key.apiKey) {
  Write-Error "No API key returned"
  exit 1
}

$card = Invoke-Json -Method "POST" -Url "$ApiBaseUrl/v1/cards" -Headers @{ Authorization = "Bearer $($key.apiKey)" } -Body @{
  kind = "note"
  title = "Smoke"
  content = "From smoke test"
}

if (-not $card.data.cardId) {
  Write-Error "Card creation failed"
  exit 1
}

$state = Invoke-RestMethod -Method "GET" -Uri "$ApiBaseUrl/v1/state?full=1" -Headers @{ Authorization = "Bearer $($key.apiKey)" }

Write-Output ("OK: card {0} grid {1} cards {2}" -f $card.data.cardId, $card.data.gridId, $state.workspace.grids[0].cardCount)
