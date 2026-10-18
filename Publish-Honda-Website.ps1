# WEP_HONDA_MARKETPLACE_IMAGES_V1
[CmdletBinding()]
param(
    [string]$Repository = 'C:\NMWEPE\GitHub\honda-equipment-configurator',
    [string]$Branch = 'main',
    [switch]$StatusOnly,
    [string]$StatusFile = '',
    [string]$MarketplaceRepository = 'C:\NMWEPE\GitHub\westendpower-marketplace-public'
)
$ErrorActionPreference = 'Stop'
$jobs = @(
    @{ Name='Honda'; Root=$Repository; Paths=@(':(glob)data/*.csv', ':(glob)images/**', 'index.html', 'Publish-Honda-Website.ps1'); Allowed='^(data/[^/]+\.csv|images/.+|index\.html|Publish-Honda-Website\.ps1)$' },
    @{ Name='Marketplace Honda'; Root=$MarketplaceRepository; Paths=@('brands/honda/data', 'brands/honda/images', 'data/marketplace-catalog.json', 'marketplace.html', 'scripts/marketplace-sync.cjs', 'scripts/honda-marketplace-images.cjs'); Allowed='^(brands/honda/(data|images)/.+|data/marketplace-catalog\.json|marketplace\.html|scripts/(marketplace-sync|honda-marketplace-images)\.cjs)$' }
)
function Invoke-RepoGit {
    param([string]$Root, [string[]]$GitArguments)
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & git -C $Root @GitArguments 2>&1
        $gitExit = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    if ($gitExit -ne 0) { throw ($output -join [Environment]::NewLine) }
    return @($output)
}
function Get-JobState {
    param($Job)
    if (!(Test-Path -LiteralPath (Join-Path $Job.Root '.git'))) { throw "Repository not found: $($Job.Root)" }
    $current = [string](Invoke-RepoGit $Job.Root @('branch','--show-current') | Select-Object -First 1)
    if ($current.Trim() -ne $Branch) { throw "Expected branch $Branch in $($Job.Root)." }
    $ahead = [int](Invoke-RepoGit $Job.Root @('rev-list','--count',"origin/$Branch..HEAD") | Select-Object -First 1)
    if ($ahead -gt 0) { return 'PUSH' }
    $changes = @(Invoke-RepoGit $Job.Root (@('status','--porcelain','--untracked-files=all','--') + $Job.Paths))
    if ($changes.Count -gt 0) { return 'CHANGES' }
    return 'CURRENT'
}
if ($StatusOnly) {
    try {
        $states = @($jobs | ForEach-Object { Get-JobState $_ })
        $state = if ($states -contains 'PUSH') { 'PUSH' } elseif ($states -contains 'CHANGES') { 'CHANGES' } else { 'CURRENT' }
    } catch { $state = 'ERROR' }
    if ($StatusFile) { [IO.File]::WriteAllText($StatusFile, $state, [Text.Encoding]::ASCII) }
    else { Write-Output $state }
    exit 0
}
try {
    Write-Host 'HONDA AND MARKETPLACE PUBLISHER' -ForegroundColor Cyan
    foreach ($job in $jobs) {
        $null = Get-JobState $job
        $null = Invoke-RepoGit $job.Root @('fetch','origin','--prune')
        $behind = [int](Invoke-RepoGit $job.Root @('rev-list','--count',"HEAD..origin/$Branch") | Select-Object -First 1)
        if ($behind -gt 0) { throw "$($job.Name) is behind origin/$Branch. Update that repository before publishing." }
        $staged = @(Invoke-RepoGit $job.Root @('diff','--cached','--name-only'))
        $outside = @($staged | Where-Object { ([string]$_) -notmatch $job.Allowed })
        if ($outside.Count -gt 0) { throw "Unrelated files are already staged in $($job.Name). Unstage those files first: $($outside -join ', ')" }
    }
    $sync = Join-Path $MarketplaceRepository 'scripts\marketplace-sync.cjs'
    $products = Join-Path $Repository 'data\products.csv'
    if (!(Test-Path -LiteralPath $sync) -or !(Test-Path -LiteralPath $products)) { throw 'Honda public products.csv or Marketplace sync script was not found.' }
    & node $sync honda $products
    if ($LASTEXITCODE -ne 0) { throw 'Honda Marketplace sync failed; publishing stopped.' }
    $hasChanges = $false
    foreach ($job in $jobs) {
        $job.Changes = @(Invoke-RepoGit $job.Root (@('status','--short','--untracked-files=all','--') + $job.Paths))
        $job.Ahead = [int](Invoke-RepoGit $job.Root @('rev-list','--count',"origin/$Branch..HEAD") | Select-Object -First 1)
        if ($job.Changes.Count -gt 0) {
            $hasChanges = $true
            Write-Host "`n$($job.Name) public files:" -ForegroundColor Yellow
            $job.Changes | ForEach-Object { Write-Host $_ }
        }
    }
    if ($hasChanges) {
        $confirmation = Read-Host 'Type PUBLISH to commit and push these public files to both repositories'
        if ($confirmation -cne 'PUBLISH') { Write-Host 'Cancelled. Nothing was staged.'; return }
    }
    foreach ($job in $jobs) {
        if ($job.Changes.Count -gt 0) {
            $null = Invoke-RepoGit $job.Root (@('add','--') + $job.Paths)
            $staged = @(Invoke-RepoGit $job.Root @('diff','--cached','--name-only'))
            if ($staged.Count -gt 0) {
                Invoke-RepoGit $job.Root @('commit','-m',"Publish Honda data and images $(Get-Date -Format 'yyyy-MM-dd HH:mm')") | ForEach-Object { Write-Host $_ }
                $job.Ahead = 1
            }
        }
        if ($job.Ahead -gt 0) {
            Write-Host "`nPushing $($job.Name)..." -ForegroundColor Cyan
            Invoke-RepoGit $job.Root @('push','origin',$Branch) | ForEach-Object { Write-Host $_ }
        }
    }
    Write-Host "`nPASS: Honda and Marketplace are published." -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'If one repository already pushed, correct the error and run the button again to finish the other.'
    Read-Host 'Press Enter to close'
    exit 1
}
Read-Host 'Press Enter to close'
