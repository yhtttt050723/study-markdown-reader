# 计算距下次唤醒秒数，输出 AGENT_LOOP_TICK 供 Cursor 监控唤醒
param(
    [string]$WakeAt = "02:30",
    [string]$Prompt = "按 nightly-study-update skill 执行夜间更新队列"
)

$now = Get-Date
$parts = $WakeAt.Split(':')
$target = Get-Date -Hour ([int]$parts[0]) -Minute ([int]$parts[1]) -Second 0
if ($target -le $now) {
    $target = $target.AddDays(1)
}
$seconds = [int](($target - $now).TotalSeconds)
Write-Host "Nightly wake scheduled at $($target.ToString('yyyy-MM-dd HH:mm:ss')) ($seconds s)"
Write-Host "Prompt: $Prompt"
Start-Sleep -Seconds $seconds
$payload = @{ prompt = $Prompt } | ConvertTo-Json -Compress
Write-Host "AGENT_LOOP_TICK_NIGHTLY_UPDATE $payload"
