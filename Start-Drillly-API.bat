@echo off
setlocal EnableExtensions
cd /d "%~dp0drillly\api"
if not exist "run.bat" (
  echo Missing drillly\api\run.bat
  pause
  exit /b 1
)
call "run.bat"
endlocal
