# Nightly git commit + push for Study, drillly, video-dash
param(
    [string]$AuthorName = 'yhtttt050723',
    [string]$AuthorEmail = 'yhtttt050723@users.noreply.github.com'
)

$ErrorActionPreference = 'Stop'
$env:GIT_AUTHOR_NAME = $AuthorName
$env:GIT_AUTHOR_EMAIL = $AuthorEmail
$env:GIT_COMMITTER_NAME = $AuthorName
$env:GIT_COMMITTER_EMAIL = $AuthorEmail

$stamp = (Get-Date -Format 'yyyy-MM-dd')
$msg = "chore: nightly sync $stamp"
$logPath = 'D:\Study\.cursor\nightly-git-log.md'
$results = @()

$repos = @(
    @{ Name = 'drillly'; Path = 'D:\Study\drillly' },
    @{ Name = 'video-dash'; Path = 'D:\Study\video-dash' },
    @{ Name = 'study-markdown-reader'; Path = 'D:\Study' }
)

function Sync-Repo($name, $path) {
    Push-Location $path
    try {
        $status = git status --porcelain 2>&1
        if (-not $status) {
            return @{ Name = $name; Result = 'skip'; Detail = 'no changes' }
        }
        git add -A 2>&1 | ForEach-Object { Write-Host $_ }
        # 二次检查 staged
        $staged = @(git diff --cached --name-only 2>$null)
        if ($staged.Count -eq 0) {
            return @{ Name = $name; Result = 'skip'; Detail = 'nothing to stage' }
        }
        $commitOut = git commit -m $msg 2>&1 | ForEach-Object { Write-Host $_; $_ }
        if ($LASTEXITCODE -ne 0) {
            return @{ Name = $name; Result = 'fail'; Detail = ($commitOut -join ' ').Trim() }
        }
        $hash = (git rev-parse --short HEAD).Trim()
        $pushOut = git push 2>&1 | ForEach-Object { Write-Host $_; $_ }
        if ($LASTEXITCODE -ne 0) {
            return @{ Name = $name; Result = 'fail'; Detail = "push failed ($hash)" }
        }
        return @{ Name = $name; Result = 'pushed'; Detail = $hash }
    }
    finally {
        Pop-Location
    }
}

foreach ($r in $repos) {
    Write-Host "=== $($r.Name) ===" -ForegroundColor Cyan
    try {
        $out = Sync-Repo $r.Name $r.Path
    }
    catch {
        $out = @{ Name = $r.Name; Result = 'fail'; Detail = $_.Exception.Message }
    }
    $results += $out
    Write-Host "$($out.Result): $($out.Detail)"
}

$now = Get-Date -Format 'yyyy-MM-dd HH:mm:ss K'
$lines = $results | ForEach-Object {
    "| $now | $($_.Name) | $($_.Result) | $($_.Detail) |"
}

if (Test-Path $logPath) {
    Add-Content -Path $logPath -Value ($lines -join "`n")
}
else {
    $header = @(
        '# Nightly Git Sync Log',
        '',
        '| 时间 | 仓库 | 结果 | 说明 |',
        '|:---|:---|:---|:---|'
    )
    Set-Content -Path $logPath -Value (($header + $lines) -join "`n") -Encoding utf8
}

Write-Host 'Done.' -ForegroundColor Green
$results | Format-Table -AutoSize
