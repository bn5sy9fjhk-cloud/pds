$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$Host.UI.RawUI.WindowTitle = 'PDS Sync'

$repo = (Get-Location).Path
$logDir = Join-Path $repo '.pds-sync'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir ('sync-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')

function Log([string]$msg) {
    $line = ('[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $msg)
    Write-Host $line
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
}
function Fail([string]$msg, [int]$code = 1) {
    Write-Host ''
    Write-Host '========================================' -ForegroundColor Red
    Write-Host $msg -ForegroundColor Red
    Write-Host '========================================' -ForegroundColor Red
    Write-Host ('Log: ' + $logFile)
    Write-Host ''
    Read-Host 'Press Enter to close'
    exit $code
}
function Run-Git([string[]]$args, [string]$proxy = '') {
    $base = @('-c','http.version=HTTP/1.1','-c','http.lowSpeedLimit=0','-c','http.lowSpeedTime=999999')
    if ($proxy) { $base += @('-c', ('http.proxy=' + $proxy)) }
    $all = $base + $args
    Log ('git ' + ($all -join ' '))
    & git @all 2>&1 | Tee-Object -FilePath $logFile -Append
    return $LASTEXITCODE
}
function Test-LocalPort([int]$port) {
    try {
        $c = New-Object System.Net.Sockets.TcpClient
        $ar = $c.BeginConnect('127.0.0.1',$port,$null,$null)
        if (-not $ar.AsyncWaitHandle.WaitOne(180)) { $c.Close(); return $false }
        $c.EndConnect($ar); $c.Close(); return $true
    } catch { return $false }
}
function Add-Mode([System.Collections.ArrayList]$list, [string]$name, [string]$proxy) {
    foreach ($m in $list) { if ($m.Proxy -eq $proxy) { return } }
    [void]$list.Add([pscustomobject]@{ Name=$name; Proxy=$proxy })
}

Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'PDS Sync 2.0' -ForegroundColor Cyan
Write-Host 'GitHub direct / proxy auto-detect' -ForegroundColor DarkGray
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail 'Git is not installed or not in PATH.' }
& git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) { Fail 'This file must be placed in the PDS Git repository root.' }

Log ('Repository: ' + $repo)

# Protect only tracked/staged edits. Untracked helper files are allowed.
& git diff --quiet
if ($LASTEXITCODE -ne 0) {
    & git status --short
    Fail 'Local tracked changes detected. Sync stopped to protect your edits.' 2
}
& git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    & git status --short
    Fail 'Local staged changes detected. Sync stopped to protect your edits.' 2
}

Log 'Checking master branch...'
& git checkout master *> $null
if ($LASTEXITCODE -ne 0) { Fail 'Could not switch to master.' }

$origin = (& git remote get-url origin 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $origin) { Fail 'Remote origin is missing.' }
Log ('Origin: ' + $origin)

# Build connection candidates. Nothing is written to global Git config.
$modes = New-Object System.Collections.ArrayList
Add-Mode $modes 'Direct connection' ''

foreach ($envName in @('HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy','ALL_PROXY','all_proxy')) {
    $v = [Environment]::GetEnvironmentVariable($envName)
    if ($v) { Add-Mode $modes ('Environment proxy: ' + $envName) $v }
}

$commonPorts = @(7890,7897,7891,10809,10808,1080,8080,8888)
foreach ($p in $commonPorts) {
    if (Test-LocalPort $p) {
        Add-Mode $modes ('Local HTTP proxy 127.0.0.1:' + $p) ('http://127.0.0.1:' + $p)
        Add-Mode $modes ('Local SOCKS5 proxy 127.0.0.1:' + $p) ('socks5h://127.0.0.1:' + $p)
    }
}

Write-Host ('Found {0} connection mode(s).' -f $modes.Count)
Write-Host ''

$selected = $null
foreach ($m in $modes) {
    Write-Host ('Testing: ' + $m.Name + ' ...') -ForegroundColor Yellow
    $code = Run-Git @('ls-remote','--exit-code','origin','refs/heads/master') $m.Proxy
    if ($code -eq 0) {
        $selected = $m
        Write-Host ('Connected: ' + $m.Name) -ForegroundColor Green
        break
    }
    Write-Host 'Failed.' -ForegroundColor DarkYellow
    Write-Host ''
}

if (-not $selected) {
    Write-Host ''
    Write-Host 'GitHub could not be reached by direct connection or detected local proxies.' -ForegroundColor Red
    $gitcode = (& git remote get-url gitcode 2>$null)
    if ($LASTEXITCODE -eq 0 -and $gitcode) {
        Write-Host ('Backup remote found: ' + $gitcode) -ForegroundColor Yellow
        Write-Host 'It is NOT used automatically because it may be older than GitHub.' -ForegroundColor Yellow
    }
    Write-Host 'If you use Clash / v2rayN / another proxy, start it and run this again.'
    Fail 'SYNC FAILED: no usable route to GitHub.' 3
}

Write-Host ''
Write-Host 'Downloading latest master...' -ForegroundColor Cyan
$fetchOK = $false
for ($i=1; $i -le 3; $i++) {
    Log ('Fetch attempt ' + $i + '/3 via ' + $selected.Name)
    $code = Run-Git @('fetch','--prune','origin','master') $selected.Proxy
    if ($code -eq 0) { $fetchOK = $true; break }
    if ($i -lt 3) { Start-Sleep -Seconds 3 }
}
if (-not $fetchOK) { Fail 'Connected once, but fetch failed after 3 attempts.' 4 }

$local = (& git rev-parse HEAD).Trim()
$remote = (& git rev-parse origin/master).Trim()
Log ('Local HEAD:  ' + $local)
Log ('Origin HEAD: ' + $remote)

if ($local -eq $remote) {
    Write-Host ''
    Write-Host 'Already up to date.' -ForegroundColor Green
} else {
    Write-Host ''
    Write-Host 'Applying update...' -ForegroundColor Cyan
    & git merge --ff-only origin/master 2>&1 | Tee-Object -FilePath $logFile -Append
    if ($LASTEXITCODE -ne 0) { Fail 'Fast-forward merge failed. Local files were not force-overwritten.' 5 }
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host 'SUCCESS: PDS is up to date.' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
$last = (& git log -1 --pretty=format:'%h  %s')
Write-Host ('Latest commit: ' + $last)
Write-Host ('Connection:    ' + $selected.Name)
Write-Host ('Log:           ' + $logFile)
Write-Host ''
Read-Host 'Press Enter to close'
