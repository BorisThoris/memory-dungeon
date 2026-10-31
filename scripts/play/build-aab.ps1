# Builds the signed release AAB for Memory Dungeon from a project generate-twa.mjs wrote.
#   powershell -File scripts\play\build-aab.ps1 -WorkDir D:\agent-work\memory-dungeon\<date>-play
# Output: <WorkDir>\android\app\build\outputs\bundle\release\app-release.aab; log in <WorkDir>\build.log.
# Calls the Gradle wrapper's main class directly: the generated gradlew.bat has LF line
# endings, which cmd cannot run, and PowerShell 5.1 turns the JDK's stderr notices into
# terminating errors. Gradle 8.11 needs a JDK from 17 to 23 (not 24).
param(
  [Parameter(Mandatory = $true)][string]$WorkDir,
  [string]$Jdk = 'C:\Program Files\Eclipse Adoptium\jdk-18.0.2.101-hotspot',
  [string]$AndroidSdk = 'E:\AndroidSDK'
)
$env:JAVA_HOME = $Jdk
$env:ANDROID_HOME = $AndroidSdk
$env:ANDROID_SDK_ROOT = $AndroidSdk
$env:GRADLE_USER_HOME = Join-Path $WorkDir 'gradle-home'
New-Item -ItemType Directory -Force (Join-Path $WorkDir 'tmp') | Out-Null
$android = Join-Path $WorkDir 'android'
if (-not (Test-Path -LiteralPath (Join-Path $android 'gradle\wrapper\gradle-wrapper.jar'))) {
  Write-Error "No generated project at $android; run generate-twa.mjs first."
  exit 1
}
Set-Content -Path (Join-Path $android 'local.properties') -Value ('sdk.dir=' + ($AndroidSdk -replace '\\', '\\' -replace ':', '\:')) -Encoding ascii
$p = Start-Process -FilePath (Join-Path $Jdk 'bin\java.exe') -WorkingDirectory $android -NoNewWindow -Wait -PassThru `
  -RedirectStandardOutput (Join-Path $WorkDir 'build.log') -RedirectStandardError (Join-Path $WorkDir 'build.err.log') `
  -ArgumentList @('"-Djava.io.tmpdir=' + (Join-Path $WorkDir 'tmp') + '"', '-classpath', '"gradle\wrapper\gradle-wrapper.jar"', 'org.gradle.wrapper.GradleWrapperMain', '--no-daemon', 'bundleRelease')
exit $p.ExitCode
