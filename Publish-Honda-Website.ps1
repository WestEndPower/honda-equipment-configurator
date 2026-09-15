[CmdletBinding()]
param(
    [string]$Repository = "C:\NMWEPE\GitHub\honda-equipment-configurator",
    [string]$Branch = "main",
    [switch]$StatusOnly, [string]$StatusFile = ""
)

$ErrorActionPreference = "Stop"
$publicPaths = @(
    ":(glob)data/*.csv",
    ":(glob)images/**",
    "index.html"
)

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    $output = & git -C $Repository @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw ($output -join [Environment]::NewLine) }
    return @($output)
}

function Get-PublishState {
    try {
        if (-not (Test-Path -LiteralPath (Join-Path $Repository ".git"))) { return "ERROR" }
        $currentBranch = (Invoke-Git branch --show-current | Select-Object -First 1).Trim()
        if ($currentBranch -ne $Branch) { return "ERROR" }
        $ahead = [int](Invoke-Git rev-list --count "origin/$Branch..HEAD" | Select-Object -First 1)
        if ($ahead -gt 0) { return "PUSH" }
        $changes = Invoke-Git status --porcelain --untracked-files=all -- @publicPaths
        if (@($changes).Count -gt 0) { return "CHANGES" }
        return "CURRENT"
    }
    catch { return "ERROR" }
}

if ($StatusOnly) {
    $state = Get-PublishState
    if ($StatusFile) {
        [System.IO.File]::WriteAllText(
            $StatusFile,
            $state,
            [System.Text.Encoding]::ASCII
        )
    }
    else {
        Write-Output $state
    }
    exit 0
}

Write-Host "HONDA WEBSITE PUBLISHER" -ForegroundColor Cyan
Write-Host "Repository: $Repository"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Git was not found." }
if (-not (Test-Path -LiteralPath (Join-Path $Repository ".git"))) { throw "Honda Git repository was not found: $Repository" }

$branchName = (Invoke-Git branch --show-current | Select-Object -First 1).Trim()
if ($branchName -ne $Branch) { throw "Expected branch '$Branch', but the repository is on '$branchName'." }

Invoke-Git fetch origin --prune | Out-Null
$behind = [int](Invoke-Git rev-list --count "HEAD..origin/$Branch" | Select-Object -First 1)
if ($behind -gt 0) { throw "Local $Branch is behind origin/$Branch by $behind commit(s). Update it before publishing." }

$changes = Invoke-Git status --short --untracked-files=all -- @publicPaths
$ahead = [int](Invoke-Git rev-list --count "origin/$Branch..HEAD" | Select-Object -First 1)

if (@($changes).Count -gt 0) {
    Write-Host "`nPUBLIC FILES TO COMMIT:" -ForegroundColor Yellow
    $changes | ForEach-Object { Write-Host $_ }
    $confirmation = Read-Host "Type PUBLISH to commit and push these public files"
    if ($confirmation -cne "PUBLISH") { Write-Host "Cancelled. Nothing was staged." -ForegroundColor Yellow; Read-Host "Press Enter to close"; exit 0 }
    Invoke-Git add -- @publicPaths | Out-Null
    $staged = Invoke-Git diff --cached --name-only
    if (@($staged).Count -eq 0) { throw "Git did not stage any approved public files." }
    Write-Host "`nSTAGED FILES:" -ForegroundColor Cyan
    $staged | ForEach-Object { Write-Host $_ }
    Invoke-Git commit -m "Publish Honda website updates $(Get-Date -Format 'yyyy-MM-dd HH:mm')" | ForEach-Object { Write-Host $_ }
    $ahead = 1
}

if ($ahead -gt 0) {
    Write-Host "`nPUSHING TO GITHUB:" -ForegroundColor Cyan
    Invoke-Git push origin $Branch | ForEach-Object { Write-Host $_ }
    Write-Host "`nPASS: Honda website changes were committed and pushed. GitHub Pages will publish them automatically." -ForegroundColor Green
} else {
    Write-Host "`nGitHub is already up to date." -ForegroundColor Green
}
Read-Host "Press Enter to close"
