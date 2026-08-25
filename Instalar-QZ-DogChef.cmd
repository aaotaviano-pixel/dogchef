@echo off
setlocal
title DogChef - Instalar impressao
echo.
echo DOGCHEF - INSTALACAO DA IMPRESSAO
echo ---------------------------------
echo Este assistente instala o QZ Tray oficial para reconhecer
echo as impressoras que ja estao instaladas no Windows.
echo.

where winget >nul 2>nul
if errorlevel 1 goto :manual

winget install --exact --id QZIndustries.QZTray --accept-package-agreements --accept-source-agreements
if errorlevel 1 goto :manual

if exist "%ProgramFiles%\QZ Tray\qz-tray.exe" start "" "%ProgramFiles%\QZ Tray\qz-tray.exe"
echo.
echo Instalacao concluida. Abra o painel DogChef, entre em Impressao
echo e clique em Reconectar.
pause
exit /b 0

:manual
echo.
echo Nao foi possivel instalar automaticamente.
echo O site oficial sera aberto. Baixe a versao Windows e mantenha
echo as opcoes padrao do instalador.
start "" "https://qz.io/download/"
pause
exit /b 1
