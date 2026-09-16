@echo off
echo =========================================================
echo   EmbroBill - Desktop App Dual Architecture Build Process
echo =========================================================
echo.

echo [Pre-build] Resetting local development data...
call python reset_dev_data.py
if %errorlevel% neq 0 (
    echo Error: Data reset failed.
    pause
    exit /b 1
)

echo [0/5] Cleaning previous distribution files...
call npm run clean -- --all
if %errorlevel% neq 0 (
    echo Warning: Clean step failed.
)

echo [1/5] Installing Node dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Error: npm install failed.
    pause
    exit /b 1
)

echo [2/5] Building React Frontend (Vite)...
call npm run build:frontend
if %errorlevel% neq 0 (
    echo Error: React frontend build failed.
    pause
    exit /b 1
)

echo [3/5] Compiling Django Backend x64 (PyInstaller)...
call npm run build:backend:x64
if %errorlevel% neq 0 (
    echo Error: Django backend x64 compilation failed.
    pause
    exit /b 1
)

echo [4/5] Compiling Django Backend x86 (PyInstaller)...
call npm run build:backend:x86
if %errorlevel% neq 0 (
    echo Error: Django backend x86 compilation failed.
    pause
    exit /b 1
)

echo [5/5] Packaging Desktop Applications (electron-builder)...
echo Packaging x64 Version...
call npm run build:dist:x64
if %errorlevel% neq 0 (
    echo Error: Desktop x64 packaging failed.
    pause
    exit /b 1
)

echo Packaging x86 Version...
call npm run build:dist:x86
if %errorlevel% neq 0 (
    echo Error: Desktop x86 packaging failed.
    pause
    exit /b 1
)

echo.
echo =========================================================
echo   Build Successful! 
echo   Windows Setup executables generated in: dist_electron\
echo   - EmbroBill Setup x64.exe
echo   - EmbroBill Setup x86.exe
echo =========================================================
pause
