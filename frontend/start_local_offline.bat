@echo off
title Lyras Pseudocode Reader - Local Offline Launcher
color 0E
echo ============================================================================
echo   LYRAS PSEUDOCODE READER // LOCAL OFFLINE LAUNCHER (.i64 / .gar / .c)
echo   100%% Local In-Browser - No Google Cloud API required!
echo ============================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! Please install Node.js LTS from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [*] Installing npm packages for offline usage...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
) else (
    echo [+] node_modules already installed.
)

echo.
echo [*] Starting local Vite server (http://localhost:5173)...
echo [*] Opening browser automatically...
start "" "http://localhost:5173"
call npm run dev
pause
