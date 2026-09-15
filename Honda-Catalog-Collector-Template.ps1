[CmdletBinding()]
param(
    [string]$Repository = "",
    [switch]$Apply,
    [switch]$Interactive,
    [switch]$Notify,
    [int]$DebugPort = 9333
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($Repository)) { $Repository = $PSScriptRoot }

$productsPath = Join-Path $Repository "data\products.csv"
$reportPath = Join-Path $Repository "WestEnd-Toro-Catalog-Report.csv"
$reportFolder = Join-Path $Repository "catalog-link-reports"
$mapPath = Join-Path $Repository "WestEnd-Toro-Catalog.json"
$seedUrl = "https://www.westendpower.com/new-models/toro-168"

function Get-EdgePath {
    $candidates = @(
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
    )
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
    }
    throw "Microsoft Edge was not found."
}

function Write-CsvNoBom($Rows, [string]$Path) {
    $content = (@($Rows | ConvertTo-Csv -NoTypeInformation) -join "`r`n") + "`r`n"
    [IO.File]::WriteAllText($Path, $content, [Text.UTF8Encoding]::new($false))
}

if (-not (Test-Path -LiteralPath $productsPath)) { throw "Products file not found: $productsPath" }
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { throw "Node.js was not found." }

$products = @(Import-Csv -LiteralPath $productsPath)
if ($products.Count -eq 0) { throw "No products were found." }
if (-not ($products[0].PSObject.Properties.Name -contains "ProductURL")) {
    throw "products.csv does not contain ProductURL."
}

$skus = @(
    $products |
        Where-Object { ([string]$_.Active).Trim().ToUpperInvariant() -ne "F" } |
        ForEach-Object { ([string]$_.SKU).Trim() } |
        Where-Object { $_ } |
        Sort-Object -Unique
)

$tempRoot = Join-Path $env:TEMP ("WestEndToroCatalog-" + [guid]::NewGuid().ToString("N"))
$nodePath = Join-Path $tempRoot "collector.js"
$skuPath = Join-Path $tempRoot "skus.json"
$edgeProfile = Join-Path $env:LOCALAPPDATA "WestEndPower\DealerSpikeCatalogBrowser"
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
New-Item -ItemType Directory -Path $edgeProfile -Force | Out-Null

$nodeSource = @'
const fs = require('fs');
const [port, seedUrl, skuPath, outputPath] = process.argv.slice(2);
const products = JSON.parse(fs.readFileSync(skuPath, 'utf8'));
const skus = products.map(product => product.SKU);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeModel = value =>
  String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const productTests = products.map(product => ({
  sku: String(product.SKU || '').trim(),
  model: normalizeModel(product.Model),
  skuTest: new RegExp(
    '(?:^|[-_/])' + esc(String(product.SKU || '').trim()) + '(?=[-_/]|$)',
    'i'
  )
}));

async function getJson(url, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch {}
    await sleep(500);
  }
  throw new Error('Could not connect to the Edge debugging session.');
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url); this.id = 0; this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve; this.ws.onerror = reject;
      this.ws.onmessage = e => {
        const m = JSON.parse(e.data);
        if (m.id && this.pending.has(m.id)) {
          const p = this.pending.get(m.id); this.pending.delete(m.id);
          m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result || {});
        }
      };
    });
  }
  async send(method, params = {}) {
    await this.ready; const id = ++this.id;
    const promise = new Promise((resolve, reject) => this.pending.set(id, {resolve, reject}));
    this.ws.send(JSON.stringify({id, method, params})); return promise;
  }
}

async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  return r.result ? r.result.value : null;
}

async function load(cdp, url) {
  await cdp.send('Page.navigate', {url});
  for (let i = 0; i < 120; i++) {
    await sleep(1000);
    const state = await evaluate(cdp, `({ready:document.readyState,title:document.title,text:(document.body?.innerText||'').slice(0,1000)})`);
    if (!state) continue;
    const challenged = /just a moment|verify you are human|performing security verification/i.test(state.title + ' ' + state.text);
    if (challenged) {
      if (i === 2) process.stdout.write('\nCloudflare verification is visible in Edge. Complete it once; collection will then continue.\n');
      continue;
    }
    if (state.ready === 'complete') { await sleep(500); return; }
  }
  throw new Error('Timed out waiting for: ' + url);
}

(async () => {
  const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
  const target = targets.find(x => x.type === 'page');
  if (!target) throw new Error('No Edge page target was found.');
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');

  const queue = [seedUrl], visited = new Set(), found = new Map();
  while (queue.length) {
    const url = queue.shift(); if (visited.has(url)) continue; visited.add(url);
    process.stdout.write(`Scanning ${visited.size}: ${url}\n`);
    await load(cdp, url);
    const links = await evaluate(cdp, `Array.from(document.querySelectorAll('a[href]')).map(a=>({url:a.href,text:(a.innerText||a.textContent||'').trim()}))`);
    for (const link of (links || [])) {
      let u; try { u = new URL(link.url); } catch { continue; }
      if (!/(^|\.)westendpower\.com$/i.test(u.hostname)) continue;
      if (!/^\/new-models\/toro-/i.test(u.pathname)) continue;
      u.hash = ''; const clean = u.href;
      const pageKey = normalizeModel(u.pathname + ' ' + link.text);
      const matches = productTests
        .filter(product =>
          product.skuTest.test(u.pathname) ||
          (product.model.length >= 5 && pageKey.includes(product.model))
        )
        .map(product => product.sku);
      const isProductPage = /-\d+b$/i.test(u.pathname);

      if (matches.length === 1) {
        const sku = matches[0];
        if (!found.has(sku)) found.set(sku, new Set());
        found.get(sku).add(clean);
      }
      else if (!isProductPage && !visited.has(clean) && !queue.includes(clean)) {
        queue.push(clean);
      }
    }
    if (visited.size > 150) throw new Error('Safety stop: more than 150 catalog category pages were discovered.');
  }

  const output = {};
  for (const sku of skus) output[sku] = found.has(sku) ? Array.from(found.get(sku)).sort() : [];
  fs.writeFileSync(outputPath, JSON.stringify({collectedAt:new Date().toISOString(), pagesScanned:visited.size, products:output}, null, 2));
  process.stdout.write(`\nCollected ${found.size} Honda model links from ${visited.size} catalog pages.\n`);
  process.exit(0);
})().catch(e => { process.stderr.write('\n' + e.stack + '\n'); process.exit(1); });
'@

try {
    [IO.File]::WriteAllText($nodePath, $nodeSource, [Text.UTF8Encoding]::new($false))
    $catalogProducts = @(
        $products |
            Where-Object {
                ([string]$_.Active).Trim().ToUpperInvariant() -ne "F"
            } |
            ForEach-Object {
                [pscustomobject]@{
                    SKU = ([string]$_.SKU).Trim()
                    Model = ([string]$_.Model).Trim()
                }
            } |
            Where-Object { $_.SKU }
    )

    [IO.File]::WriteAllText(
        $skuPath,
        ($catalogProducts | ConvertTo-Json -Depth 4),
        [Text.UTF8Encoding]::new($false)
    )

    $edge = Get-EdgePath
    Write-Host "WEST END TORO CATALOG COLLECTOR" -ForegroundColor Cyan
    Write-Host "A dedicated Edge window will open. If Cloudflare asks, complete its verification once."
    $edgeArguments = @(
        "--remote-debugging-port=$DebugPort",
        "--user-data-dir=`"$edgeProfile`"",
        "--no-first-run", "--no-default-browser-check", $seedUrl
    )
    $edgeProcess = Start-Process -FilePath $edge -ArgumentList $edgeArguments -PassThru

    & node.exe $nodePath $DebugPort $seedUrl $skuPath $mapPath
    if ($LASTEXITCODE -ne 0) { throw "Toro catalog collection failed." }

    $map = Get-Content -LiteralPath $mapPath -Raw | ConvertFrom-Json
    $report = [Collections.Generic.List[object]]::new()
    $proposedBySku = @{}
    $changes = 0
    foreach ($product in $products) {
        $sku = ([string]$product.SKU).Trim()
        $active = ([string]$product.Active).Trim().ToUpperInvariant() -ne "F"
        $current = ([string]$product.ProductURL).Trim()
        $urls = @()
        if ($sku -and $map.products.PSObject.Properties.Name -contains $sku) { $urls = @($map.products.$sku) }
        $resolved = $current
        $status = if ($active) { "Missing" } else { "Inactive" }
        if ($active -and $urls.Count -ge 1) {
            $rankedUrls = @(
                $urls |
                    Sort-Object -Property @{
                        Expression = {
                            if ($_ -match '(\d+)b/?$') {
                                [long]$matches[1]
                            }
                            else {
                                0
                            }
                        }
                    } -Descending
            )

            $resolved = $rankedUrls[0]

            if ($resolved -eq $current) { $status = "Unchanged" }
            elseif (-not $current) { $status = "New" }
            else { $status = "Changed" }
        }
        elseif ($active) {
            $resolved = ""
            $status = if ($current) { "Removed" } else { "Missing" }
        }
        if ($resolved -ne $current) { $changes++ }
        if ($sku) { $proposedBySku[$sku] = $resolved }
        $report.Add([pscustomobject]@{
            SKU=$sku; Model=([string]$product.Model).Trim(); Status=$status
            OldProductURL=$current; NewProductURL=$resolved; CandidateCount=$urls.Count
        })
    }

    New-Item -ItemType Directory -Path $reportFolder -Force | Out-Null
    $datedReportPath = Join-Path $reportFolder ("WestEnd-Toro-Catalog-{0}.csv" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
    Write-CsvNoBom $report $reportPath
    Write-CsvNoBom $report $datedReportPath

    $counts = @{}
    foreach ($group in @($report | Group-Object Status)) { $counts[$group.Name] = $group.Count }
    $summaryText = @"
Dealer Spike Toro catalog scan complete

New links: $($counts['New'])
Changed links: $($counts['Changed'])
Removed links: $($counts['Removed'])
Unchanged links: $($counts['Unchanged'])
Still missing: $($counts['Missing'])
Inactive: $($counts['Inactive'])

Proposed changes: $changes
"@

    $applyNow = [bool]$Apply
    if ($Interactive -and $changes -gt 0 -and -not $Apply) {
        Add-Type -AssemblyName PresentationFramework
        $choice = [System.Windows.MessageBox]::Show(
            $summaryText + "`nApply these ProductURL changes?",
            "Refresh Dealer Spike Links",
            [System.Windows.MessageBoxButton]::YesNo,
            [System.Windows.MessageBoxImage]::Question
        )
        $applyNow = $choice -eq [System.Windows.MessageBoxResult]::Yes
    }

    if ($applyNow -and $changes -gt 0) {
        $backup = "$productsPath.before-dealerspike-catalog-links"
        Copy-Item -LiteralPath $productsPath -Destination $backup -Force
        foreach ($product in $products) {
            $sku = ([string]$product.SKU).Trim()
            if ($sku -and $proposedBySku.ContainsKey($sku)) { $product.ProductURL = $proposedBySku[$sku] }
        }
        Write-CsvNoBom $products $productsPath
        Write-Host "Backup: $backup"
    } else { Write-Host "`nREPORT ONLY: products.csv was not changed." -ForegroundColor Yellow }

    Write-Host "`nRESULTS:" -ForegroundColor Cyan
    $report | Group-Object Status | Sort-Object Name | ForEach-Object { Write-Host ("{0,-26} {1,5}" -f $_.Name, $_.Count) }
    Write-Host "Catalog pages scanned: $($map.pagesScanned)"
    Write-Host "Proposed ProductURL changes: $changes"
    Write-Host "Report: $reportPath"
    Write-Host "Dated report: $datedReportPath"

    if ($Notify) {
        Add-Type -AssemblyName PresentationFramework
        $resultText = if ($applyNow -and $changes -gt 0) { "Changes applied." } else { "No changes applied." }
        [void][System.Windows.MessageBox]::Show(
            $summaryText + "`n" + $resultText + "`n`nReport:`n" + $datedReportPath,
            "Refresh Dealer Spike Links",
            [System.Windows.MessageBoxButton]::OK,
            [System.Windows.MessageBoxImage]::Information
        )
    }
}
finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
