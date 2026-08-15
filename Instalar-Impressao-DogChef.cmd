@echo off
title Instalador de Impressao - DogChef
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0agent\setup-windows.ps1" -ProjectRoot "%~dp0"
echo.
pause
