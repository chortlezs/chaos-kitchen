param(
    [string]$ToolRoot = 'D:\esp\xiao-tools',
    [switch]$Upload,
    [string]$Port = ''
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$cli = Join-Path $ToolRoot 'cli\arduino-cli.exe'
$config = Join-Path $ToolRoot 'arduino-cli.yaml'
$sketch = Join-Path $ToolRoot 'work\xiao_foot'
$build = Join-Path $ToolRoot 'work\build'
$output = Join-Path $ToolRoot 'work\output'
$runtime = Join-Path $repo '.hardware-runtime'
New-Item -ItemType Directory -Force -Path $sketch,$build,$output,$runtime | Out-Null
Copy-Item -LiteralPath (Join-Path $repo 'hardware\xiao-foot\xiao_foot\xiao_foot.ino') -Destination (Join-Path $sketch 'xiao_foot.ino') -Force
$log = Join-Path $runtime 'xiao-build.log'
& $cli compile --config-file $config --fqbn 'Seeeduino:nrf52:xiaonRF52840Sense' --build-path $build --output-dir $output $sketch *> $log
if ($LASTEXITCODE -ne 0) {
    Get-Content -LiteralPath $log -Tail 35
    throw "XIAO build failed. Full log: $log"
}
Get-Content -LiteralPath $log -Tail 8
Write-Output "XIAO build OK. Artifacts: $output"
if ($Upload) {
    $device = Get-PnpDevice -PresentOnly -Class Ports | Where-Object {
        (-not $Port -or $_.FriendlyName -match ('\(' + [regex]::Escape($Port) + '\)$')) -and
        $_.InstanceId -match 'VID_2886&PID_(8045|0045)'
    }
    if (@($device).Count -ne 1) { throw "No XIAO nRF52840 Sense found on $Port; refusing upload." }
    if (-not $Port) { $Port = [regex]::Match($device.FriendlyName, '\((COM\d+)\)$').Groups[1].Value }
    & $cli upload --config-file $config --fqbn 'Seeeduino:nrf52:xiaonRF52840Sense' --port $Port --input-dir $output
    if ($LASTEXITCODE -ne 0) { throw 'XIAO application upload failed.' }
}
