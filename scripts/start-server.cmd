@echo off
rem Starts the VinylVault server (Claude vision + Discogs prices) on port 8788.
for %%I in ("%~dp0..\server") do set "SERVER=%%~fI"
cd /d "%SERVER%"
if not exist node_modules call npm.cmd install --no-audit --no-fund
call npm.cmd start
