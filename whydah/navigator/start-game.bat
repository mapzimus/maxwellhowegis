@echo off
REM Double-click to start the Whydah Navigator and open it in your browser.
cd /d "%~dp0"
set "PY=C:\Users\Calen\miniforge3\pythonw.exe"
if not exist "%PY%" set "PY=C:\Users\Calen\miniforge3\python.exe"
start "" "%PY%" "%~dp0server.py" 8000
timeout /t 1 >nul
start "" "http://localhost:8000"
