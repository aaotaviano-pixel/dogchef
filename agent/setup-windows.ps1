[CmdletBinding()]
param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot))

$ErrorActionPreference = "Stop"

function Read-SecretText([string]$Prompt) {
  $secure = Read-Host -Prompt $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Get-PhysicalPrinters {
  $virtualPattern = "OneNote|Print to PDF|XPS Document Writer|^Fax$|Send to OneNote"
  @(Get-CimInstance -ClassName Win32_Printer | Where-Object {
    $_.Name -and $_.Name -notmatch $virtualPattern -and $_.DriverName -notmatch $virtualPattern
  } | Select-Object Name, Default, WorkOffline, DriverName)
}

$resolvedRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$agentDirectory = Join-Path $resolvedRoot "agent"
$agentEnv = Join-Path $agentDirectory ".env"
$installScript = Join-Path $agentDirectory "install-windows.ps1"

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue) -or -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  throw "Instale o Node.js LTS e abra este instalador novamente. Apos instalar, nao e preciso abrir terminal no dia a dia."
}

if (-not (Test-Path -LiteralPath (Join-Path $resolvedRoot "node_modules\.bin\tsx.cmd"))) {
  Write-Host "Preparando o DogChef pela primeira vez..." -ForegroundColor Yellow
  & npm.cmd ci --prefix $resolvedRoot
  if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel preparar os arquivos do DogChef." }
}

if (Test-Path -LiteralPath $agentEnv) {
  $replace = Read-Host "Esta maquina ja possui uma configuracao de impressao. Digite S para substituir ou pressione Enter para manter"
  if ($replace.Trim().ToUpperInvariant() -ne "S") {
    Write-Host "Mantendo a configuracao atual e iniciando o servico..." -ForegroundColor Cyan
    & $installScript -ProjectRoot $resolvedRoot
    exit $LASTEXITCODE
  }
}

Write-Host "`nConfiguracao simples da impressao DogChef" -ForegroundColor Cyan
Write-Host "A impressora precisa estar instalada e aparecer em Configuracoes > Impressoras do Windows." -ForegroundColor DarkGray

$defaultUrl = "https://dogchef-one.vercel.app"
$apiUrl = Read-Host "Endereco do site [$defaultUrl]"
if ([string]::IsNullOrWhiteSpace($apiUrl)) { $apiUrl = $defaultUrl }
$parsedUri = $null
if (-not [Uri]::TryCreate($apiUrl, [UriKind]::Absolute, [ref]$parsedUri)) { throw "O endereco do site nao e valido." }
$apiUrl = $apiUrl.TrimEnd("/")

$computerName = $env:COMPUTERNAME
if ([string]::IsNullOrWhiteSpace($computerName)) { $computerName = "windows" }
$defaultAgentId = "cozinha-" + ($computerName.ToLowerInvariant() -replace "[^a-z0-9-]", "-")
$agentId = Read-Host "Nome deste computador [$defaultAgentId]"
if ([string]::IsNullOrWhiteSpace($agentId)) { $agentId = $defaultAgentId }

Write-Host "`nCole a chave de conexao da impressao. Ela nao aparece enquanto voce digita." -ForegroundColor Yellow
$token = Read-SecretText "Chave de conexao"
if ([string]::IsNullOrWhiteSpace($token)) { throw "A chave de conexao e obrigatoria." }

@(
  "DOGCHEF_API_URL=$apiUrl",
  "PRINT_AGENT_TOKEN=$token",
  "PRINT_AGENT_ID=$agentId"
) | Set-Content -LiteralPath $agentEnv -Encoding utf8

$printers = Get-PhysicalPrinters
if ($printers.Count -eq 0) {
  Write-Host "`nNenhuma impressora fisica foi encontrada no Windows." -ForegroundColor Yellow
  Write-Host "Instale a impressora primeiro. Depois execute este mesmo arquivo novamente." -ForegroundColor Yellow
} else {
  Write-Host "`nImpressoras encontradas automaticamente:" -ForegroundColor Green
  $printers | ForEach-Object { Write-Host (" - " + $_.Name + $(if ($_.Default) { " (padrao do Windows)" } else { "" })) }
  Write-Host "A impressora marcada como padrao sera escolhida automaticamente no painel." -ForegroundColor Green
}

& $installScript -ProjectRoot $resolvedRoot
if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel iniciar o servico de impressao." }

Write-Host "`nPronto. O DogChef Print Agent iniciara com o Windows." -ForegroundColor Green
Write-Host "Abra o painel administrativo, entre em Impressao e use Atualizar impressoras." -ForegroundColor Green
Write-Host "Depois escolha Testar impressao para confirmar a fila." -ForegroundColor Green
