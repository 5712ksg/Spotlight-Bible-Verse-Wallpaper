@echo off
setlocal

@echo off
set "BASE_DIR=%~dp0"
set "FOLDER_1=3825407599"
set "FOLDER_2=Webview2"

set "SOURCE_DIR_1=%BASE_DIR%%FOLDER_1%"
set "SOURCE_DIR_2=%BASE_DIR%%FOLDER_2%"
set "DEST_DIR_1=%LOCALAPPDATA%\Lively Wallpaper\Library\wallpapers\%FOLDER_1%"
set "DEST_DIR_2=%LOCALAPPDATA%\Programs\Lively Wallpaper\Plugins\%FOLDER_2%"

echo ...
if not exist "%DEST_DIR_1%" mkdir "%DEST_DIR_1%"
if not exist "%DEST_DIR_2%" mkdir "%DEST_DIR_2%"

echo ...
taskkill /F /IM "Lively.Watchdog.exe" /T >nul 2>&1
taskkill /F /IM "Lively.UI.WinUI.exe" /T >nul 2>&1
taskkill /F /IM "Lively.Player.WebView2.exe" /T >nul 2>&1
timeout /t 2 /nobreak >nul
tasklist /FI "IMAGENAME eq Lively.Player.WebView2.exe" ^
    | find /I "Lively.Player.WebView2.exe" >nul
if not errorlevel 1 (
    pause
    exit /b 1
)
echo ...

xcopy "%SOURCE_DIR_1%" "%DEST_DIR_1%" /E /I /Y
xcopy "%SOURCE_DIR_2%" "%DEST_DIR_2%" /E /I /Y