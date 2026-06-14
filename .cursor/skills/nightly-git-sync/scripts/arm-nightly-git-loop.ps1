param(
    [string]$WakeAt = '02:30',
    [string]$Prompt = '按 nightly-git-sync skill 执行夜间 git 提交推送'
)

$now = Get-Date
$parts = $WakeAt.Split(':')
$target = Get-Date -Hour ([int]$parts[0]) -Minute ([int]$parts[1]) -Second 0
if ($target -le $now) {
    $target = $target.AddDays(1)
}
$seconds = [int](($target - $now).TotalSeconds)
Write-Host "Nightly git sync at $($target.ToString('yyyy-MM-dd HH:mm:ss')) ($seconds s)"
Write-Host "Prompt: $Prompt"
Start-Sleep -Seconds $seconds
$payload = @{ prompt = $Prompt } | ConvertTo-Json -Compress
Write-Host "AGENT_LOOP_TICK_NIGHTLY_GIT $payload"
