[CmdletBinding()]
param([string]$TaskName = "DogChef Print Agent")

$ErrorActionPreference = "Stop"
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "DogChef Print Agent removido do Agendador de Tarefas."
