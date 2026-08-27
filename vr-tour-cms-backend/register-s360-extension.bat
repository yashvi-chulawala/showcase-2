@echo off
setlocal

:: Requires Administrator privileges to write to HKEY_CLASSES_ROOT, but since we are modifying HKEY_CURRENT_USER, it shouldn't need elevation.
:: However, for safety and broad compatibility, HKEY_CURRENT_USER is safer.

set EXTENSION=.s360
set FILETYPE=Showcase360.Project
set ICON_PATH=%~dp0showcase360.ico

echo Registering %EXTENSION% file extension...

:: 1. Register the extension to point to our custom file type
reg add "HKCU\Software\Classes\%EXTENSION%" /ve /d "%FILETYPE%" /f >nul

:: 2. Create the file type definition
reg add "HKCU\Software\Classes\%FILETYPE%" /ve /d "Showcase 360 Project" /f >nul

:: 3. Set the icon
reg add "HKCU\Software\Classes\%FILETYPE%\DefaultIcon" /ve /d "\"%ICON_PATH%\"" /f >nul

:: Note: We intentionally do NOT set a shell\open\command. 
:: Because Showcase 360 requires a backend server to run, native double-click is not currently supported.
:: The user must open the app in the browser and use "Open Project".

echo.
echo ==============================================================
echo Success! The .s360 extension has been registered.
echo The icon has been set to: %ICON_PATH%
echo.
echo NOTE: You may need to restart Windows Explorer for the 
echo icon to appear on existing .s360 files.
echo ==============================================================
pause
