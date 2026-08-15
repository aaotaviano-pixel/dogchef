[CmdletBinding()]
param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot))

$ErrorActionPreference = "Stop"
$resolvedRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$logDirectory = Join-Path $resolvedRoot "agent\logs"
$logFile = Join-Path $logDirectory "print-agent.log"
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

try {
  & npm.cmd run print-agent --prefix $resolvedRoot *>> $logFile
  exit $LASTEXITCODE
} catch {
  "$(Get-Date -Format o) PRINT_SERVICE_FATAL $($_.Exception.Message)" | Add-Content -LiteralPath $logFile
  exit 1
}
