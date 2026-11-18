<#
  Build a clean zip of the project for sharing: NO .env files, no secrets, no virtual environment, no node_modules,
  no screenshots, no caches, no build output.

    powershell -ExecutionPolicy Bypass -File .\make_share_zip.ps1

  The zip is written next to the project folder (not inside it): skillsense-ai-share-YYYYMMDD-HHMM.zip.
  Before zipping, the staged copy is scanned for anything that looks like a real secret; if one is found the zip is
  NOT created and only the file name (never the value) is printed.
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$stage = Join-Path ([System.IO.Path]::GetTempPath()) "skillsense-share-$stamp"
$zip = Join-Path (Split-Path -Parent $root) "skillsense-ai-share-$stamp.zip"

$excludeDirs = @('.git', '.claude', '.venv', 'venv', 'node_modules', 'dist', 'python_bin', '__pycache__', '.pytest_cache', '.vite',
                 'screenshots', '.results', 'test-results', 'playwright-report', '.idea', '.vscode')
$excludeFiles = @('.env', '.env.local', '.env.*.local', '*.pyc', '*.log', '*.zip', 'Thumbs.db')

Write-Host "Copying the project (without secrets, environments, caches and screenshots) ..."
New-Item -ItemType Directory -Path $stage | Out-Null
$null = robocopy $root $stage /E /XD $excludeDirs /XF $excludeFiles /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with code $LASTEXITCODE" }

# --- safety net: no .env file may be in the copy (only the *.example templates) -----------------------------------------
$envFiles = Get-ChildItem -Path $stage -Recurse -Force -File | Where-Object { $_.Name -like '.env*' -and $_.Name -ne '.env.example' }
if ($envFiles) {
  $envFiles | ForEach-Object { Write-Host "BLOCKED: $($_.FullName.Substring($stage.Length))" }
  Remove-Item -Recurse -Force $stage
  throw 'An .env file ended up in the copy. No zip was created.'
}

# --- safety net: scan text files for things that look like real secrets (names only are printed) -------------------------
$patterns = @(
  'mongodb\+srv://[^<\s:/@]+:[^<\s@]+@',      # a connection string with real credentials (placeholders use <user>:<password>)
  'AIza[0-9A-Za-z_\-]{30,}',                  # Google API key
  'GOCSPX-[0-9A-Za-z_\-]{10,}',               # Google OAuth client secret
  '-----BEGIN (RSA |EC )?PRIVATE KEY-----'
)
$textExt = '.py', '.js', '.jsx', '.json', '.md', '.txt', '.example', '.bat', '.sh', '.ps1', '.html', '.css', '.ini', '.yml', '.yaml', '.toml'
$hits = @()
Get-ChildItem -Path $stage -Recurse -Force -File | Where-Object { $textExt -contains $_.Extension -or $_.Name -like '.env*' } | ForEach-Object {
  $file = $_
  foreach ($p in $patterns) {
    if (Select-String -Path $file.FullName -Pattern $p -Quiet) { $hits += $file.FullName.Substring($stage.Length); break }
  }
}
if ($hits) {
  Write-Host 'Something that looks like a real secret was found in these files (values are not printed):'
  $hits | Sort-Object -Unique | ForEach-Object { Write-Host "  $_" }
  Remove-Item -Recurse -Force $stage
  throw 'No zip was created. Remove the secret from those files and run this again.'
}

Write-Host "Zipping ..."
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal
Remove-Item -Recurse -Force $stage
$mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host ""
Write-Host "Done: $zip ($mb MB)"
Write-Host "The other computer unzips it, runs setup_new_computer.bat, fills in backend\.env, then runs run_dev.bat."
