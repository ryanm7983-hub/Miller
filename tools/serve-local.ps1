# A static file server with no dependencies, for playing the game locally.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File serve-local.ps1
#
# This exists because the game cannot be run by opening index.html: browsers
# refuse `fetch` on a file:// URL and the engine has to fetch a 37 MB runtime.
# Every other way of serving a folder needs something installed first. Windows
# PowerShell is already there.
#
# Written against Windows PowerShell 5.1 — no `??`, no ternaries, no PS7-only
# syntax — so it runs on a stock Windows box with nothing added.
#
# TcpListener rather than HttpListener: HttpListener goes through http.sys and
# can demand a URL reservation, which means an admin prompt on some machines.
# A socket on 127.0.0.1 never does.

param(
	[int]$Port = 8000,
	[string]$Root = $PSScriptRoot,
	[switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

$mimeTypes = @{
	'.html' = 'text/html; charset=utf-8';
	'.js'   = 'text/javascript; charset=utf-8';
	'.mjs'  = 'text/javascript; charset=utf-8';
	'.json' = 'application/json; charset=utf-8';
	'.txt'  = 'text/plain; charset=utf-8';
	'.css'  = 'text/css; charset=utf-8';
	# Correct on purpose: with the right type the browser can compile the engine
	# while it downloads instead of waiting for all 37 MB to land first.
	'.wasm' = 'application/wasm';
	'.pck'  = 'application/octet-stream';
	'.png'  = 'image/png';
	'.jpg'  = 'image/jpeg';
	'.svg'  = 'image/svg+xml';
	'.ico'  = 'image/x-icon';
	'.wav'  = 'audio/wav';
	'.ogg'  = 'audio/ogg';
}

$rootFull = (Resolve-Path -LiteralPath $Root).Path

function Get-MimeType([string]$path) {
	$extension = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
	if ($mimeTypes.ContainsKey($extension)) { return $mimeTypes[$extension] }
	return 'application/octet-stream'
}

# Resolve a request path to a file inside the served folder, or $null. The
# containment check is what stops "GET /../../secrets" from leaving the folder.
function Resolve-RequestPath([string]$target) {
	$clean = $target.Split('?')[0].Split('#')[0]
	try { $clean = [System.Uri]::UnescapeDataString($clean) } catch { return $null }
	if ($clean -eq '/' -or $clean -eq '') { $clean = '/index.html' }
	$relative = $clean.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
	$candidate = [System.IO.Path]::GetFullPath((Join-Path $rootFull $relative))
	if (-not $candidate.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
		return $null
	}
	if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { return $null }
	return $candidate
}

function Write-Header($stream, [int]$status, [string]$reason, [string]$type, [long]$length) {
	$header = "HTTP/1.1 $status $reason`r`n"
	$header += "Content-Type: $type`r`n"
	$header += "Content-Length: $length`r`n"
	# No caching: a stale copy of a 37 MB payload is the single most confusing
	# thing that can happen while testing a build.
	$header += "Cache-Control: no-store`r`n"
	$header += "Connection: close`r`n`r`n"
	$bytes = [System.Text.Encoding]::ASCII.GetBytes($header)
	$stream.Write($bytes, 0, $bytes.Length)
}

# Read request headers a byte at a time. Mixing a StreamReader with the binary
# writes below would buffer past the headers and eat the start of the body.
function Read-RequestLine($stream) {
	$builder = New-Object System.Text.StringBuilder
	$previous = 0
	while ($true) {
		$current = $stream.ReadByte()
		if ($current -lt 0) { return $null }
		if ($previous -eq 13 -and $current -eq 10) {
			return $builder.ToString().TrimEnd([char]13)
		}
		[void]$builder.Append([char]$current)
		$previous = $current
	}
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
try {
	$listener.Start()
} catch {
	Write-Host ''
	Write-Host "  Could not listen on port $Port - something else is probably using it."
	Write-Host "  Try:  powershell -NoProfile -ExecutionPolicy Bypass -File serve-local.ps1 -Port 8080"
	Write-Host ''
	Read-Host 'Press Enter to close'
	exit 1
}

$url = "http://localhost:$Port/"
Write-Host ''
Write-Host '  THE BLACK PINE - serving locally'
Write-Host ''
Write-Host "  folder   $rootFull"
Write-Host "  address  $url"
Write-Host ''
Write-Host '  Leave this window open while you play. Close it to stop.'
Write-Host ''

if (-not $NoBrowser) {
	try { Start-Process $url } catch { Write-Host "  Open $url yourself." }
}

while ($true) {
	$client = $listener.AcceptTcpClient()
	try {
		$stream = $client.GetStream()
		# A browser opens speculative connections it never sends anything on.
		# Without a timeout the accept loop would block on the first of them
		# forever, and the page would hang with no explanation.
		$stream.ReadTimeout = 5000
		$requestLine = Read-RequestLine $stream
		if ($null -eq $requestLine -or $requestLine -eq '') { continue }

		# Drain the remaining headers so the client is not left mid-write.
		while ($true) {
			$line = Read-RequestLine $stream
			if ($null -eq $line -or $line -eq '') { break }
		}

		$parts = $requestLine.Split(' ')
		if ($parts.Length -lt 2) { continue }
		$method = $parts[0]
		$target = $parts[1]
		$path = Resolve-RequestPath $target

		if ($null -eq $path) {
			$body = [System.Text.Encoding]::UTF8.GetBytes('not found')
			Write-Header $stream 404 'Not Found' 'text/plain; charset=utf-8' $body.Length
			$stream.Write($body, 0, $body.Length)
			Write-Host ("  404  " + $target)
		} else {
			$info = New-Object System.IO.FileInfo($path)
			Write-Header $stream 200 'OK' (Get-MimeType $path) $info.Length
			if ($method -ne 'HEAD') {
				# Streamed rather than read into memory: the engine alone is 37 MB.
				$file = [System.IO.File]::OpenRead($path)
				try { $file.CopyTo($stream, 65536) } finally { $file.Close() }
			}
			Write-Host ("  200  " + $target + "  (" + [math]::Round($info.Length / 1MB, 1) + " MB)")
		}
		$stream.Flush()
	} catch {
		# One bad or abandoned connection must never take the server down.
	} finally {
		$client.Close()
	}
}
