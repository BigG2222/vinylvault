@echo off
rem Builds the Google Play upload file (.aab), signed with the upload key in Documents\VinylVault-signing,
rem and copies it to the Desktop. Bump "versionCode" in app.json before every new upload.
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"
for %%I in ("%~dp0..") do set "ROOT=%%~fI"
cd /d "%ROOT%"

if not exist "%USERPROFILE%\Documents\VinylVault-signing\keystore.properties" (
  echo The upload key is missing from Documents\VinylVault-signing. Restore it from your backup first.
  exit /b 1
)

echo === Generating native Android project ===
call npx.cmd expo prebuild --platform android --no-install --clean
if errorlevel 1 goto :fail
node "%ROOT%\scripts\patch-android.js"
if errorlevel 1 goto :fail

echo === Building Google Play bundle ===
cd /d "%ROOT%\android"
call "%ROOT%\android\gradlew.bat" bundleRelease
if errorlevel 1 goto :fail
cd /d "%ROOT%"

copy /y "%ROOT%\android\app\build\outputs\bundle\release\app-release.aab" "%USERPROFILE%\Desktop\VinylVault-for-Google-Play.aab" >nul
echo.
echo === BUILD SUCCEEDED ===
echo Upload this file to Google Play: %USERPROFILE%\Desktop\VinylVault-for-Google-Play.aab
exit /b 0

:fail
echo.
echo === BUILD FAILED - see the messages above ===
exit /b 1
