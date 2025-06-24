@echo off
SETLOCAL

REM Define paths
set "SRC_DIST=E:\anocm\client\dist"
set "DST_DIR=E:\anocm\server\dist"
set "SRC_ASSETS=E:\anocm\server\dist\assets"
set "DST_ASSETS=E:\anocm\server\public"

REM Delete old dist folder in server if it exists
if exist "%DST_DIR%" (
    echo Deleting existing server\dist folder...
    rmdir /s /q "%DST_DIR%"
)

REM Move dist from client to server
echo Moving dist to server...
move "%SRC_DIST%" "%DST_DIR%\.."

REM Delete existing assets in public if they exist
if exist "%DST_ASSETS%" (
    echo Deleting existing server\public\assets folder...
    rmdir /s /q "%DST_ASSETS%"
)

REM Move assets to public
echo Moving assets to public...
move "%SRC_ASSETS%" "%DST_ASSETS%\.."

echo Done.
pause
