@echo off
setlocal

cd /d "%~dp0"
title NestledBurrow - local game

set "NODE_EXE="
for /f "delims=" %%I in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%I"

if not defined NODE_EXE (
    if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
)

if not defined NODE_EXE (
    echo Node.js was not found.
    echo Install Node.js LTS from https://nodejs.org/ and run this file again.
    pause
    exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
    where npm >nul 2>nul
    if errorlevel 1 (
        echo Project dependencies are missing and npm was not found.
        echo Install Node.js LTS from https://nodejs.org/ and run this file again.
        pause
        exit /b 1
    )

    echo Installing project dependencies...
    call npm ci
    if errorlevel 1 (
        echo Failed to install project dependencies.
        pause
        exit /b 1
    )
)

echo Starting the current local version of NestledBurrow...
echo The browser will open automatically. Close this window to stop the game server.
"%NODE_EXE%" "node_modules\vite\bin\vite.js" --host 127.0.0.1 --open

if errorlevel 1 (
    echo The local game server stopped with an error.
    pause
    exit /b 1
)
