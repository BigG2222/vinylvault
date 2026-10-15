@echo off
rem Starts the VinylVault app for Expo Go. On the phone: Expo Go, "Enter URL manually", exp://192.168.4.31:8083 (CardVault uses 8081)
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
cd /d "%ROOT%"
call npx.cmd expo start --go --port 8083
