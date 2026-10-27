@echo off
echo ========================================
echo  PLAGA ZOMBIE: MANABI - FASE 1
echo  Simulador Estrategico
echo ========================================
echo.
echo Instalando dependencias...
echo.
call npm install
echo.
echo ========================================
echo Iniciando servidor de desarrollo...
echo.
echo El juego se abrira en: http://localhost:3000
echo.
echo Presiona Ctrl+C para detener el servidor
echo ========================================
echo.
call npm run dev
