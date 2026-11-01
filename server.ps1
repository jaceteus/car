param(
    [int]$Port = 8123
)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$rootWithSlash = $root.TrimEnd('\') + '\'

$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.ico'  = 'image/x-icon'
    '.woff' = 'font/woff'
    '.woff2' = 'font/woff2'
    '.txt'  = 'text/plain; charset=utf-8'
    '.md'   = 'text/plain; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()

Write-Host "Rally Rush local server"
Write-Host "Serving: $root"
Write-Host "Address: http://127.0.0.1:$Port/"
Write-Host "Close this window to stop the server."

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            $relative = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath).TrimStart('/')
            if ([string]::IsNullOrWhiteSpace($relative)) {
                $relative = 'index.html'
            }

            $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
            if (-not $fullPath.StartsWith($rootWithSlash, [System.StringComparison]::OrdinalIgnoreCase) -or
                -not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
                $response.StatusCode = 404
                $body = [System.Text.Encoding]::UTF8.GetBytes('404 - Not found')
                $response.ContentType = 'text/plain; charset=utf-8'
                $response.ContentLength64 = $body.Length
                $response.OutputStream.Write($body, 0, $body.Length)
            } else {
                $bytes = [System.IO.File]::ReadAllBytes($fullPath)
                $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
                $response.ContentType = $mime[$extension]
                if (-not $response.ContentType) {
                    $response.ContentType = 'application/octet-stream'
                }
                $response.Headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        } catch {
            if ($response.OutputStream) {
                $response.StatusCode = 500
            }
        } finally {
            $response.Close()
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
