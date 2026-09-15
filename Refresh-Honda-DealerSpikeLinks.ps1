[CmdletBinding()]
param([switch]$Interactive, [switch]$Notify)

$ErrorActionPreference = "Stop"
$repo = "C:\NMWEPE\GitHub\honda-equipment-configurator"
$source = Join-Path $PSScriptRoot "Honda-Catalog-Collector-Template.ps1"
$generated = Join-Path $env:TEMP "Collect-WestEndHondaCatalog.ps1"

if (-not (Test-Path -LiteralPath $source)) { throw "Toro catalog collector source was not found: $source" }
if (-not (Test-Path -LiteralPath (Join-Path $repo "data\products.csv"))) { throw "Honda products.csv was not found in: $repo" }

$text = [IO.File]::ReadAllText($source)
$replacements = [ordered]@{
    'WestEndToroCatalog' = 'WestEndHondaCatalog'
    'WestEnd-Toro-Catalog' = 'WestEnd-Honda-Catalog'
    'WEST END TORO CATALOG COLLECTOR' = 'WEST END HONDA CATALOG COLLECTOR'
    'Dealer Spike Toro catalog scan complete' = 'Dealer Spike Honda catalog scan complete'
    'Toro catalog collection failed.' = 'Honda catalog collection failed.'
    'https://www.westendpower.com/new-models/toro-168' = 'https://www.westendpower.com/new-models/honda-power-equipment-156'
    '/^\/new-models\/toro-/i' = '/^\/new-models\/(?:honda-|\d{4}-honda-)/i'
}
foreach ($pair in $replacements.GetEnumerator()) {
    if (-not $text.Contains($pair.Key)) { throw "Collector conversion block was not found: $($pair.Key)" }
    $text = $text.Replace($pair.Key, $pair.Value)
}
[IO.File]::WriteAllText($generated, $text, [Text.UTF8Encoding]::new($false))

$arguments = @('-NoProfile','-ExecutionPolicy','Bypass','-File',$generated,'-Repository',$repo)
if ($Interactive) { $arguments += '-Interactive' }
if ($Notify) { $arguments += '-Notify' }
& powershell.exe @arguments
exit $LASTEXITCODE
