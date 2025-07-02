@echo off
SETLOCAL

REM Define base path
set "BASE_DIR=%~dp0"
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"
REM Define paths
set "CLIENT_DIR=%BASE_DIR%\client"
set "SERVER_DIR=%BASE_DIR%\server"
set "SHARED_DIR=%BASE_DIR%\shared"
set "SRC_DIST=%CLIENT_DIR%\dist"
set "DST_DIR=%SERVER_DIR%\dist"
set "SRC_ASSETS=%SERVER_DIR%\dist\assets"
set "DST_ASSETS=%SERVER_DIR%\public\assets"

if "%1"=="help" (
   echo Usage: ^(.\^)build.bat option[help^|start^|start-local ?^<port^>]
   echo.
   echo Installs the dependencies, compiles TypeScript files, builds the client, and moves the built files to the server directory.
   echo.
   echo Options:
   echo   help        - Show this help message.
   echo   start       - In addition: Start the server.
   echo   start-local port - In addition: Start the server locally ^(index_local.js^). If a port is specified, the local server will use that port.
   echo.
   pause
   goto :end
)

REM Step 1: Install dependencies
echo Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to install dependencies in base directory.
    pause
    exit /b %ERRORLEVEL%
)

REM Step 2: Build shared TypeScript
echo Running 'tsc' in shared...
pushd "%SHARED_DIR%"
call tsc
if %ERRORLEVEL% NEQ 0 (
    echo Error: TypeScript compilation failed in shared directory.
    pause
    exit /b %ERRORLEVEL%
)
popd

REM Step 3: Build server TypeScript
echo Running 'tsc' in server...
pushd "%SERVER_DIR%"
call tsc
if %ERRORLEVEL% NEQ 0 (
    echo Error: TypeScript compilation failed.
    pause
    exit /b %ERRORLEVEL%
)
popd

REM Step 4: Build client
echo Running 'npm run build' in client...
pushd "%CLIENT_DIR%"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Error: Client build failed.
    pause
    exit /b %ERRORLEVEL%
)
popd

REM Step 5: Delete old dist folder in server if it exists
if exist "%DST_DIR%" (
    echo Deleting existing server\dist folder...
    rmdir /s /q "%DST_DIR%"
)

REM Step 6: Move dist from client to server
echo Moving dist to server...
move "%SRC_DIST%" "%DST_DIR%\.."

REM Step 7: Delete existing assets in public if they exist
if exist "%DST_ASSETS%" (
    echo Deleting existing server\public\assets folder...
    rmdir /s /q "%DST_ASSETS%"
)

REM Step 8: Move assets to public
echo Moving assets to public...
move "%SRC_ASSETS%" "%DST_ASSETS%\.."

echo Finished building.

if "%1"=="start" (
    echo Starting server...
    pushd "%SERVER_DIR%"
    call node .
    if %ERRORLEVEL% NEQ 0 (
        echo Error: Failed to start the server.
        pause
        exit /b %ERRORLEVEL%
    )
    popd
    goto :end
) 
if "%1"=="start-local" (
    echo Starting server locally...
    pushd "%SERVER_DIR%"
    call node index_local.js "%2"
    if %ERRORLEVEL% NEQ 0 (
        echo Error: Failed to start the local server.
        pause
        exit /b %ERRORLEVEL%
    )
    popd
    goto :end
)

echo.
echo To start the server, run: 'node .' in %SERVER_DIR%
echo If you want to start the server locally, use 'node index_local.js' instead of 'node .'.
echo.

pause
:end
exit /b 0