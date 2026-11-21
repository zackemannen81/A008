param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = (Get-Command node.exe -ErrorAction Stop).Source
$port = 8787
$db = Join-Path $env:USERPROFILE '.a008\platform.sqlite'

# The host owns all sessions; do not kill an active one by accident.
if ((Test-Path -LiteralPath $db) -and -not $Force) {
    Push-Location $repo
    try {
        $active = & $node (Join-Path $repo "check-a008-active.cjs") $db
        if ($LASTEXITCODE -ne 0) { throw 'Could not read A008 run status. Nothing stopped.' }
        if ([int]$active -gt 0) {
            throw "A008 has $active running/queued run(s). Stop or complete them first. -Force overrides this safeguard."
        }
    } finally { Pop-Location }
}

$listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
    $ownerPid = [int]$listener.OwningProcess
    $ownerProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerPid"
    if (!$ownerProcess -or $ownerProcess.Name -ne 'node.exe' -or
        $ownerProcess.CommandLine -notmatch 'gui-host[\\/]server\.js') {
        throw "Port $port belongs to another program (PID $ownerPid). Refusing to stop it."
    }
    Write-Host "Stopping A008 host PID $ownerPid ..."
    Stop-Process -Id $ownerPid -Force
    Start-Sleep -Milliseconds 650
}

$logDir = 'C:\log'
if (!(Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
Write-Host "Starting A008 from $repo ..."
$child = Start-Process -FilePath $node -WorkingDirectory $repo -ArgumentList @(
    '--env-file-if-exists=.env.local',
    './dist/src/gui-host/server.js'
) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'a008-host.stdout.log') -RedirectStandardError (Join-Path $logDir 'a008-host.stderr.log')

for ($attempt = 0; $attempt -lt 12; $attempt++) {
    Start-Sleep -Milliseconds 700
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port/" -TimeoutSec 2 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "A008 READY - PID $($child.Id) - http://localhost:$port" -ForegroundColor Green
            exit 0
        }
    } catch {
        if ($child.HasExited) { break }
    }
}
Write-Warning "A008 did not respond yet. Check $logDir\a008-host.stderr.log"
exit 1
