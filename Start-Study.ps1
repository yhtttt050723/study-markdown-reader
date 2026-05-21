# Study launcher (ASCII filename — use Start-Study.bat to run)
param(
    [switch]$OpenBrowser = $true,
    [switch]$ReaderOnly,
    [switch]$NoReader,
    [switch]$NoVideoDash,
    [switch]$NoDrillly,
    [switch]$WithKb
)

$StudyRoot = $PSScriptRoot
$LogFile = Join-Path $StudyRoot 'study-suite-launch.log'

function Write-Log {
    param([string]$Message)
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Host $Message
}

try {
    Write-Log "=== Study launch start ==="
    $PortsFile = Join-Path $StudyRoot 'study-suite.ports.json'
    $ResolvedFile = Join-Path $StudyRoot 'study-suite.resolved.json'

    if (-not (Test-Path $PortsFile)) {
        throw "Missing $PortsFile"
    }

    $portsDef = Get-Content $PortsFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $resolved = [ordered]@{}

    function Test-PortAvailable {
        param([int]$Port)
        try {
            $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
            return -not $c
        }
        catch {
            return $true
        }
    }

    function Resolve-Port {
        param([int]$Preferred, [int[]]$Fallbacks = @())
        $candidates = @($Preferred) + @($Fallbacks)
        foreach ($p in $candidates) {
            if (Test-PortAvailable -Port $p) { return $p }
        }
        throw "All ports busy: $($candidates -join ', ')"
    }

    function Resolve-AppDir {
        param([string[]]$Candidates)
        foreach ($p in $Candidates) {
            $full = Join-Path $StudyRoot $p
            if (Test-Path (Join-Path $full 'package.json')) { return $full }
        }
        return $null
    }

    function Start-DevWindow {
        param(
            [string]$Title,
            [string]$WorkDir,
            [hashtable]$EnvVars,
            [string]$Command = 'npm run dev',
            [switch]$EnsureNpmInstall
        )
        if (-not $WorkDir) { return }
        if ($EnsureNpmInstall -and -not (Test-Path (Join-Path $WorkDir 'node_modules'))) {
            Write-Log "$Title first-time npm install ..."
            Push-Location $WorkDir
            npm install --no-fund --no-audit 2>&1 | Out-Host
            Pop-Location
        }
        $setEnv = ($EnvVars.GetEnumerator() | ForEach-Object {
            "`$env:$($_.Key)='$($_.Value)'"
        }) -join '; '
        $cmd = if ($setEnv) { "$setEnv; " } else { '' }
        $cmd += "Set-Location -LiteralPath '$($WorkDir -replace "'", "''")'; $Command"
        Start-Process powershell.exe -ArgumentList @(
            '-NoExit',
            '-Command',
            "`$Host.UI.RawUI.WindowTitle = '$Title'; $cmd"
        ) | Out-Null
        Write-Log "[OK] $Title -> $WorkDir"
    }

    function Start-DrilllyApi {
        param([string]$ApiDir, [int]$Port, [string]$Title)
        if (-not (Test-Path $ApiDir)) {
            Write-Log "[SKIP] Drillly API dir missing: $ApiDir"
            return $false
        }
        $venvPy = Join-Path $ApiDir '.venv\Scripts\python.exe'
        if (-not (Test-Path $venvPy)) {
            Write-Log "Drillly API: creating venv ..."
            Push-Location $ApiDir
            python -m venv .venv
            if ($LASTEXITCODE -ne 0) { throw 'python -m venv failed. Install Python 3.11+.' }
            .\.venv\Scripts\pip install -r requirements.txt -q
            if (-not (Test-Path '.env')) { Copy-Item .env.example .env -ErrorAction SilentlyContinue }
            .\.venv\Scripts\python scripts\seed_demo.py
            Pop-Location
        }
        $apiDirEsc = $ApiDir -replace "'", "''"
        $pyEsc = $venvPy -replace "'", "''"
        $cmd = @"
Set-Location -LiteralPath '$apiDirEsc'
`$env:DRILLLY_PORT = '$Port'
`$env:STUDY_DRILLLY_API_PORT = '$Port'
if (-not (Test-Path '.env')) { Copy-Item .env.example .env -ErrorAction SilentlyContinue }
& '$pyEsc' scripts\seed_demo.py 2>`$null
Write-Host 'Drillly API http://127.0.0.1:$Port/docs'
& '$pyEsc' -m uvicorn main:app --host 127.0.0.1 --port $Port --reload
"@
        Start-Process powershell.exe -ArgumentList @(
            '-NoExit',
            '-Command',
            "`$Host.UI.RawUI.WindowTitle = '$Title'; $cmd"
        ) | Out-Null
        Write-Log "[OK] $Title -> $ApiDir (port $Port)"
        return $true
    }

    if ($ReaderOnly) {
        $NoVideoDash = $true
        $NoDrillly = $true
    }

    $urls = [System.Collections.Generic.List[string]]::new()

    if (-not $NoReader) {
        $p = Resolve-Port -Preferred $portsDef.mdReader.vite -Fallbacks @($portsDef.mdReader.fallbacks)
        $resolved.mdReader = $p
        # Reader runs as Electron desktop app — do not open localhost in browser
    }
    if (-not $NoVideoDash) {
        $p = Resolve-Port -Preferred $portsDef.videoDash.vite -Fallbacks @($portsDef.videoDash.fallbacks)
        $resolved.videoDash = $p
        $urls.Add("http://localhost:$p")
    }
    if (-not $NoDrillly) {
        $apiP = Resolve-Port -Preferred $portsDef.drilllyApi.http -Fallbacks @($portsDef.drilllyApi.fallbacks)
        $webP = Resolve-Port -Preferred $portsDef.drilllyWeb.vite -Fallbacks @($portsDef.drilllyWeb.fallbacks)
        $resolved.drilllyApi = $apiP
        $resolved.drilllyWeb = $webP
        $urls.Add("http://localhost:$webP")
    }

    if ($WithKb) {
        $p = Resolve-Port -Preferred $portsDef.kbServer.http -Fallbacks @($portsDef.kbServer.fallbacks)
        $resolved.kbServer = $p
    }

    $resolved | ConvertTo-Json | Set-Content -Path $ResolvedFile -Encoding UTF8

    Write-Host ''
    Write-Host '=== Study ===' -ForegroundColor Cyan
    Write-Host "Root: $StudyRoot"
    Write-Host ''

    $readerDir = Resolve-AppDir @('md-reader-app', '软件\md-reader-app')
    $videoDir = Resolve-AppDir @('video-dash')
    $drilllyWebDir = Resolve-AppDir @('drillly\web', 'drillly\frontend')
    $drilllyApiDir = Join-Path $StudyRoot 'drillly\api'
    $kbDir = Resolve-AppDir @('md-reader-app\kb-server', '软件\md-reader-app\kb-server')
    $kbPort = $resolved.kbServer

    if (-not $NoReader -and $readerDir) {
        $envReader = @{ STUDY_READER_PORT = $resolved.mdReader }
        if ($kbPort) { $envReader.STUDY_KB_PORT = $kbPort }
        Start-DevWindow -Title $portsDef.mdReader.label -WorkDir $readerDir -EnvVars $envReader
        Start-Sleep -Seconds 2
    }
    elseif (-not $NoReader) {
        Write-Log '[WARN] md-reader-app not found'
    }

    if (-not $NoVideoDash -and $videoDir) {
        Start-DevWindow -Title $portsDef.videoDash.label -WorkDir $videoDir -EnvVars @{
            STUDY_VIDEO_PORT = $resolved.videoDash
        }
    }
    elseif (-not $NoVideoDash) {
        Write-Log '[WARN] video-dash not found'
    }

    if (-not $NoDrillly) {
        Start-DrilllyApi -ApiDir $drilllyApiDir -Port $resolved.drilllyApi -Title $portsDef.drilllyApi.label | Out-Null
        Start-Sleep -Seconds 1
        if ($drilllyWebDir) {
            Start-DevWindow -Title $portsDef.drilllyWeb.label -WorkDir $drilllyWebDir -EnsureNpmInstall -EnvVars @{
                STUDY_DRILLLY_WEB_PORT = $resolved.drilllyWeb
                STUDY_DRILLLY_API_PORT = $resolved.drilllyApi
            }
        }
    }

    if ($WithKb -and $kbDir -and $kbPort) {
        Start-DevWindow -Title $portsDef.kbServer.label -WorkDir $kbDir -EnvVars @{ KB_PORT = $kbPort } -Command 'npm run start'
    }

    Write-Host ''
    Write-Host 'Ports (see study-suite.resolved.json):' -ForegroundColor Green
    if ($resolved.mdReader) {
        Write-Host "  Reader      Electron desktop (Vite dev :$($resolved.mdReader), do not use browser)"
    }
    if ($resolved.videoDash) { Write-Host "  video-dash  http://localhost:$($resolved.videoDash)" }
    if ($resolved.drilllyWeb) {
        Write-Host "  Drillly     http://localhost:$($resolved.drilllyWeb)"
        Write-Host "  Drillly API http://127.0.0.1:$($resolved.drilllyApi)/docs"
    }
    Write-Host ''
    Write-Log 'Launch finished OK'

    if ($OpenBrowser -and $urls.Count -gt 0) {
        Write-Host 'Opening browser in 8s ...' -ForegroundColor Cyan
        Start-Sleep -Seconds 8
        foreach ($u in $urls) {
            Start-Process $u
            Start-Sleep -Milliseconds 400
        }
    }
}
catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    Write-Host ''
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray
    Write-Host ''
    Write-Host "Log: $LogFile" -ForegroundColor Yellow
    exit 1
}
