@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo Close Drillly API window first, then press any key...
pause >nul
if not exist ".venv\Scripts\python.exe" (
  echo Venv missing. Run run.bat once to create it.
  pause
  exit /b 1
)
call ".venv\Scripts\python.exe" scripts\reset_all.py
echo.
pause
endlocal
