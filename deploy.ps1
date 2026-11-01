param(
    [string]$Message = ""
)

$ErrorActionPreference = 'Stop'

$Owner = 'jaceteus'
$Repo = 'car'
$Branch = 'main'
$PagesUrl = "https://$Owner.github.io/$Repo/"
$RepoUrl = "https://github.com/$Owner/$Repo"

$Files = @(
    '.gitattributes',
    '.gitignore',
    'README.md',
    'deploy.bat',
    'deploy.ps1',
    'game.js',
    'index.html',
    'server.ps1',
    'start-game.bat',
    'style.css'
)

if ([string]::IsNullOrWhiteSpace($Message)) {
    $Message = 'Deploy Rally Rush ({0})' -f (Get-Date -Format 'yyyy-MM-dd HH:mm')
}

$token = $env:GITHUB_TOKEN
if ([string]::IsNullOrWhiteSpace($token)) {
    $secure = Read-Host 'GitHub token (Contents: Read and write)' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

if ([string]::IsNullOrWhiteSpace($token)) {
    throw 'No GitHub token supplied.'
}

$headers = @{
    Authorization          = "Bearer $token"
    Accept                 = 'application/vnd.github+json'
    'User-Agent'           = 'rally-rush-deploy'
    'X-GitHub-Api-Version' = '2022-11-28'
}

function Invoke-GitHubApi {
    param(
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null
    )

    $params = @{
        Uri         = "https://api.github.com$Endpoint"
        Method      = $Method
        Headers     = $headers
        TimeoutSec  = 45
    }

    if ($null -ne $Body) {
        $params.Body = $Body | ConvertTo-Json -Depth 20 -Compress
        $params.ContentType = 'application/json'
    }

    Invoke-RestMethod @params
}

try {
    Write-Host ''
    Write-Host '  RALLY RUSH - GitHub Pages deploy' -ForegroundColor Yellow
    Write-Host "  $RepoUrl"
    Write-Host ''

    $ref = Invoke-GitHubApi -Method 'GET' -Endpoint "/repos/$Owner/$Repo/git/ref/heads/$Branch"
    $headSha = $ref.object.sha
    $headCommit = Invoke-GitHubApi -Method 'GET' -Endpoint "/repos/$Owner/$Repo/git/commits/$headSha"

    Write-Host "  Current commit: $($headSha.Substring(0, 7))"
    Write-Host '  Uploading site files...'

    $treeEntries = @()
    foreach ($file in $Files) {
        $fullPath = Join-Path $PSScriptRoot $file
        if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
            Write-Warning "  Skipping missing file: $file"
            continue
        }

        $bytes = [System.IO.File]::ReadAllBytes($fullPath)
        $blob = Invoke-GitHubApi -Method 'POST' -Endpoint "/repos/$Owner/$Repo/git/blobs" -Body @{
            content  = [Convert]::ToBase64String($bytes)
            encoding = 'base64'
        }

        $treeEntries += @{
            path = $file.Replace('\', '/')
            mode = '100644'
            type = 'blob'
            sha  = $blob.sha
        }
        Write-Host "    + $file"
    }

    if ($treeEntries.Count -eq 0) {
        throw 'No deployable files were found.'
    }

    $tree = Invoke-GitHubApi -Method 'POST' -Endpoint "/repos/$Owner/$Repo/git/trees" -Body @{
        base_tree = $headCommit.tree.sha
        tree      = $treeEntries
    }

    $commit = Invoke-GitHubApi -Method 'POST' -Endpoint "/repos/$Owner/$Repo/git/commits" -Body @{
        message = $Message
        tree    = $tree.sha
        parents = @($headSha)
    }

    Invoke-GitHubApi -Method 'PATCH' -Endpoint "/repos/$Owner/$Repo/git/refs/heads/$Branch" -Body @{
        sha   = $commit.sha
        force = $false
    } | Out-Null

    Write-Host ''
    Write-Host "  Pushed commit $($commit.sha.Substring(0, 7)) to $Branch." -ForegroundColor Green
    Write-Host "  Commit: $RepoUrl/commit/$($commit.sha)"
    Write-Host "  Pages:  $PagesUrl"
    Write-Host ''
    Write-Host '  GitHub Pages will rebuild in about 30-60 seconds.'
    Write-Host ''
} catch {
    Write-Host ''
    Write-Host '  DEPLOYMENT FAILED' -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
        Write-Host "  $($_.ErrorDetails.Message)" -ForegroundColor DarkGray
    }
    Write-Host ''
    exit 1
}
