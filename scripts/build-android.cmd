@echo off
rem Builds a standalone release APK of VinylVault and installs it on a USB-connected phone if one is attached.
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
cd /d "%ROOT%"

echo === Generating native Android project ===
call npx.cmd expo prebuild --platform android --no-install
if errorlevel 1 goto :fail
node "%ROOT%\scripts\patch-android.js"
if errorlevel 1 goto :fail

echo === Building release APK (first build takes 10-20 minutes) ===
cd /d "%ROOT%\android"
call "%ROOT%\android\gradlew.bat" assembleRelease
if errorlevel 1 goto :fail
cd /d "%ROOT%"

set "APK=%ROOT%\android\app\build\outputs\apk\release\app-release.apk"
echo.
echo === BUILD SUCCEEDED ===
echo APK: %APK%
adb get-state >nul 2>&1
if errorlevel 1 (
  echo No phone connected. Plug it in with USB debugging on, then run: adb install -r "%APK%"
  exit /b 0
)
echo === Installing on phone ===
adb install -r "%APK%"
exit /b %errorlevel%

:fail
echo.
echo === BUILD FAILED - see the messages above ===
exit /b 1
