@echo off
setlocal EnableExtensions
cd /d "%~dp0"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Study.ps1" -ReaderOnly -NoOpenBrowser %*
set EXITCODE=%ERRORLEVEL%
echo.
if %EXITCODE% neq 0 (
  echo [FAILED] exit code %EXITCODE%. See study-suite-launch.log
) else (
  echo [OK] Markdown Reader Electron window should open shortly.
)
pause
endlocal
