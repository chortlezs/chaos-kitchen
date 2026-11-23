@echo off
setlocal
set "KITCHEN_PYTHON=%MOSAICO_PYTHON%"
if not defined KITCHEN_PYTHON set "KITCHEN_PYTHON=D:\anaconda3\python.exe"
if not exist "%KITCHEN_PYTHON%" set "KITCHEN_PYTHON=python"
"%KITCHEN_PYTHON%" "%~dp0tools\start-hardware.py" --transport ble --foot
if errorlevel 1 pause
