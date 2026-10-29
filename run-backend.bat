@echo off
REM ============================================================
REM  CODEIT CareerOS - Backend runner (Spring Boot)
REM  Usage:  run-backend.bat
REM  Stops with Ctrl+C. Backend: http://localhost:8080
REM ============================================================
setlocal
cd /d "%~dp0careeros-backend"

set "JAR=target\careeros-backend-0.1.0-SNAPSHOT.jar"
if not exist "%JAR%" (
  echo [ERROR] Backend jar not found: %CD%\%JAR%
  echo [ERROR] There is no Maven wrapper in this repo and 'mvn' is not installed,
  echo [ERROR] so the jar cannot be rebuilt from here. Reuse the prebuilt jar.
  exit /b 1
)

REM --- Find a Java 21+ runtime (project targets Java 21, default java is 17) ---
set "JAVA_BIN="
if exist "C:\Program Files\Java\jdk-24\bin\java.exe" (
  set "JAVA_BIN=C:\Program Files\Java\jdk-24\bin\java.exe"
) else if defined JAVA_HOME (
  if exist "%JAVA_HOME%\bin\java.exe" set "JAVA_BIN=%JAVA_HOME%\bin\java.exe"
)
if not defined JAVA_BIN (
  for /f "delims=" %%J in ('where java 2^>nul') do (
    if not defined JAVA_BIN set "JAVA_BIN=%%J"
  )
)
if not defined JAVA_BIN (
  echo [ERROR] No Java found. Install JDK 21 or newer.
  echo [ERROR] This machine previously used: C:\Program Files\Java\jdk-24
  exit /b 1
)
"%JAVA_BIN%" -version 2>&1 | findstr /r "version .2[1-9] version .3[0-9]" >nul
if errorlevel 1 (
  echo [ERROR] "%JAVA_BIN%" is older than Java 21.
  echo [ERROR] This project needs Java 21+. Point JAVA_HOME to a JDK 21+,
  echo [ERROR] e.g. C:\Program Files\Java\jdk-24
  "%JAVA_BIN%" -version
  exit /b 1
)

REM --- Warn (don't fail) if MySQL is not reachable on localhost:3306 ---
powershell -noprofile -command "$c=New-Object Net.Sockets.TcpClient; try { $ok=$c.BeginConnect('localhost',3306,$null,$null).AsyncWaitHandle.WaitOne(2000); } catch { $ok=$false }; $c.Close(); exit ([int](-not $ok))" >nul 2>nul
if errorlevel 1 (
  echo [WARN] MySQL on localhost:3306 is not reachable. The backend needs it.
  echo [WARN] Start MySQL first, then re-run this script if boot fails.
)

echo [INFO] Using Java: %JAVA_BIN%
"%JAVA_BIN%" -version 2>&1 | findstr version
echo [INFO] Starting backend with profile 'dev' ...
echo [INFO] Open: http://localhost:8080/swagger-ui.html  (Ctrl+C to stop)
REM --- Google Sign-In: prefer the shared GOOGLE_CLIENT_ID in the repo-root .env ---
if not defined GOOGLE_CLIENT_ID if exist "%~dp0.env" for /f "tokens=2 delims==" %%A in ('findstr /b "GOOGLE_CLIENT_ID=" "%~dp0.env"') do set "GOOGLE_CLIENT_ID=%%A"
if not defined GOOGLE_CLIENT_ID set "GOOGLE_CLIENT_ID=77849822296-afqnenl0hs9rhdokenbin2k68sfhi3cg.apps.googleusercontent.com"
"%JAVA_BIN%" -jar "%JAR%" --spring.profiles.active=dev
