[CmdletBinding()]
param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$TaskName = "DogChef Print Agent"
)

$ErrorActionPreference = "Stop"
$resolvedRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$agentEnv = Join-Path $resolvedRoot "agent\.env"
if (-not (Test-Path -LiteralPath $agentEnv -PathType Leaf)) {
  throw "Arquivo agent\.env nao encontrado. Copie agent\.env.example e configure o token antes de instalar."
}

$cmd = (Get-Command cmd.exe -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$user = "$env:USERDOMAIN\$env:USERNAME"
$arguments = "/d /c `"$npm`" run print-agent --prefix `"$resolvedRoot`""

$action = New-ScheduledTaskAction -Execute $cmd -Argument $arguments -WorkingDirectory $resolvedRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host "DogChef Print Agent instalado e iniciado para $user."
Write-Host "Tarefa: $TaskName"
