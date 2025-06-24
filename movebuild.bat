@echo off
SETLOCAL

REM Define paths
set "CLIENT_DIR=E:\anocm\client"
set "SERVER_DIR=E:\anocm\server"
set "SRC_DIST=%CLIENT_DIR%\dist"
set "DST_DIR=%SERVER_DIR%\dist"
set "SRC_ASSETS=%SERVER_DIR%\dist\assets"
set "DST_ASSETS=%SERVER_DIR%\public"

REM Step 1: Build server TypeScript
echo Running tsc in server...
pushd "%SERVER_DIR%"
call tsc
if %ERRORLEVEL% NEQ 0 (
    echo Error: TypeScript compilation failed.
    pause
    exit /b %ERRORLEVEL%
)
popd

REM Step 2: Build client
echo Running npm run build in client...
pushd "%CLIENT_DIR%"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Error: Client build failed.
    pause
    exit /b %ERRORLEVEL%
)
popd

REM Step 3: Delete old dist folder in server if it exists
if exist "%DST_DIR%" (
    echo Deleting existing server\dist folder...
    rmdir /s /q "%DST_DIR%"
)

REM Step 4: Move dist from client to server
echo Moving dist to server...
move "%SRC_DIST%" "%DST_DIR%\.."

REM Step 5: Delete existing assets in public if they exist
if exist "%DST_ASSETS%" (
    echo Deleting existing server\public\assets folder...
    rmdir /s /q "%DST_ASSETS%"
)

REM Step 6: Move assets to public
echo Moving assets to public...
move "%SRC_ASSETS%" "%DST_ASSETS%\.."

echo Done.
pause
