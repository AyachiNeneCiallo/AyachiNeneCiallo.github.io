# 启动博客文章编辑器（由「打开编辑器.bat」调用）
$ErrorActionPreference = 'Stop'

$here = $PSScriptRoot                                   # tools\editor
$root = Split-Path (Split-Path $here -Parent) -Parent    # 项目根目录
$port = 4322
$url = "http://localhost:$port"
$server = Join-Path $here 'server.mjs'

function Test-EditorPort {
  param([int]$Port)
  [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host '[错误] 没有找到 node，请先安装 Node.js 并确保它在 PATH 里。' -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $server)) {
  Write-Host "[错误] 找不到 $server" -ForegroundColor Red
  exit 1
}

if (-not (Test-EditorPort $port)) {
  Write-Host '正在启动文章编辑器…'
  Start-Process -FilePath 'node' -ArgumentList ('"' + $server + '"') -WorkingDirectory $root -WindowStyle Hidden | Out-Null

  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-EditorPort $port) { $ready = $true; break }
  }
  if (-not $ready) {
    Write-Host '[错误] 启动超时。可以手动运行： npm.cmd run editor' -ForegroundColor Red
    exit 1
  }
}

Write-Host "编辑器已就绪：$url"
Start-Process $url
exit 0
