@echo off
setlocal EnableExtensions
cd /d "%~dp0drillly\api"
if not exist "reset-db.bat" (
  echo Missing drillly\api\reset-db.bat
  pause
  exit /b 1
)
call "reset-db.bat"
endlocal
