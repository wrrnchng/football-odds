@echo off
REM Football Odds - One-Click Startup Script
REM This script automates the setup and startup process for the application

echo ========================================
echo   Football Odds - Startup Script
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Display Node.js version
echo [INFO] Node.js version:
node --version
echo.

REM Navigate to frontend directory
if exist "frontend" (
    cd frontend
    echo [INFO] Changed to frontend directory
) else (
    echo [ERROR] frontend directory not found!
    echo Please ensure you're running this script from the project root.
    echo.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo [INFO] node_modules not found. Installing dependencies...
    echo This may take a few minutes...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
    echo [SUCCESS] Dependencies installed successfully!
    echo.
) else (
    echo [INFO] Dependencies already installed
    echo.
)

REM Check if database exists, if not initialize it
if not exist "football-odds.db" (
    echo [INFO] Database not found. Initializing database...
    echo.
    call npm run db:push
    if %ERRORLEVEL% NEQ 0 (
        echo [WARNING] Database initialization had issues, but continuing...
        echo.
    ) else (
        echo [SUCCESS] Database initialized successfully!
        echo.
    )
) else (
    echo [INFO] Database file found
    echo.
)

REM Display startup information
echo ========================================
echo   Starting Development Server
echo ========================================
echo.
echo The application will be available at:
echo   http://localhost:3000
echo.
echo Note: On first startup, the server will automatically
echo fetch match data. This may take a few minutes.
echo.
echo Press Ctrl+C to stop the server
echo.
echo ========================================
echo.

REM Start the development server
call npm run dev

REM If the server exits, pause to see any error messages
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Server exited with an error
    pause
)

