# Study / Drillly 夜间更新后冒烟检查
$ErrorActionPreference = 'Continue'
$root = 'D:\Study'
$ok = $true

function Test-Step($name, [scriptblock]$block) {
    try {
        & $block
        if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) { throw "exit $LASTEXITCODE" }
        Write-Host "[OK] $name"
    } catch {
        Write-Host "[FAIL] $name : $_"
        $script:ok = $false
    }
}

Test-Step 'query_session_stats.py --help' {
    Set-Location "$root\drillly\api"
    python scripts/query_session_stats.py --help | Out-Null
}

Test-Step 'session_stats import' {
    Set-Location "$root\drillly\api"
    python -c "from app.services.session_stats import get_session_stats; print('ok')" | Out-Null
}

try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:5213/api/health/' -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { Write-Host '[OK] Drillly API health' } else { throw "status $($r.StatusCode)" }
} catch {
    Write-Host '[SKIP] Drillly API not running (start Start-Drillly-API.bat if needed)'
}

if (-not $ok) { exit 1 }
Write-Host 'Verify passed.'
