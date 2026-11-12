# 停止博客文章编辑器（由「停止编辑器.bat」调用）
$port = 4322

$conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if (-not $conns) {
  Write-Host '编辑器没有在运行。'
  exit 0
}

$processIds = $conns.OwningProcess | Sort-Object -Unique
foreach ($procId in $processIds) {
  try {
    Stop-Process -Id $procId -Force -ErrorAction Stop
    Write-Host "已停止进程 $procId"
  } catch {
    Write-Host "停止进程 $procId 失败：$($_.Exception.Message)" -ForegroundColor Red
  }
}
exit 0
