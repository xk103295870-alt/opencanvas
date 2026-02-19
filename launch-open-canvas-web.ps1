$appUrl = 'http://127.0.0.1:4173'
$appDir = 'E:\VS开发文件\open-canvas-web'

$ok = $false
try {
  $r = Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 2
  if ($r.StatusCode -eq 200) { $ok = $true }
} catch {}

if (-not $ok) {
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c npm run dev -- --host 0.0.0.0 --port 4173' -WorkingDirectory $appDir -WindowStyle Minimized
  Start-Sleep -Seconds 3
}

Start-Process $appUrl
