@echo off
REM Start the backend (port 8000) and the frontend (port 5500) in two windows,
REM then open the admin login page. Double-click this file to run it.
REM Paths are relative to this file, so it works no matter where you start it from.
REM (Comments are in English on purpose: cmd may garble UTF-8 text on some code pages.)

set "ROOT=%~dp0"

REM Refuse to start when the ports are already taken. Otherwise the NEW server fails to
REM bind and the OLD one (still running old code) keeps answering, so new features seem broken.
set "BUSY="
netstat -ano | findstr /R /C:":8000 .*LISTENING" >nul && set "BUSY=8000 %BUSY%"
netstat -ano | findstr /R /C:":5500 .*LISTENING" >nul && set "BUSY=5500 %BUSY%"
if defined BUSY goto ports_busy

REM Make sure the Python packages are installed. Safe to run every time:
REM it does nothing when everything is already installed.
echo Checking Python packages...
python -m pip install -q -r "%ROOT%backend\requirements.txt"
if errorlevel 1 goto install_failed

REM Backend API: must run inside the backend folder
start "Backend API - port 8000" /d "%ROOT%backend" cmd /k python -m uvicorn main:app --port 8000

REM Frontend: the web root MUST be the frontend folder, otherwise /js/... files are not found
start "Frontend - port 5500" /d "%ROOT%frontend" cmd /k python -m http.server 5500

REM Give the servers a moment to start, then open the login page
timeout /t 3 /nobreak >nul
start "" "http://localhost:5500/admin/login.html"
goto :eof

:ports_busy
echo.
echo Port(s) already in use: %BUSY%
echo An OLD "Backend API" / "Frontend" window is probably still open and running old code.
echo Close those old windows (click them and press Ctrl+C, or just close them),
echo then run this file again.
echo.
echo Press any key to close this window.
pause >nul
goto :eof

:install_failed
echo.
echo Package installation failed. Read the message above, then press any key to close.
pause >nul
