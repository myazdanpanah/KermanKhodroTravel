# Export SQL Server tables to CSV for the Nexivo importer.
#
# Usage (PowerShell, on a machine that can reach SQL Server and has the
# SqlServer module installed - it ships with SSMS 20+/22):
#
#   .\export-mssql.ps1 -ServerInstance "localhost\SQLEXPRESS" -Database "MyDb" -OutputDir ".\mssql_export"
#
#   # SQL authentication instead of Windows auth:
#   .\export-mssql.ps1 -ServerInstance "srv01" -Database "MyDb" -User "sa" -Password "***"
#
#   # only some tables:
#   .\export-mssql.ps1 -ServerInstance "srv01" -Database "MyDb" -Tables Customers,Invoices
#
# The script writes one UTF-8 CSV per table (with a header row) plus a
# _manifest.json listing schema/table/column metadata.  The Nexivo
# `mssql_import` command reads that folder directly.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ServerInstance,
    [Parameter(Mandatory = $true)][string]$Database,
    [string]$OutputDir = ".\mssql_export",
    [string]$User,
    [string]$Password,
    [string[]]$Tables = @(),
    [int]$QueryTimeout = 0
)

$ErrorActionPreference = "Stop"

try {
    Import-Module SqlServer -ErrorAction Stop
} catch {
    throw "The 'SqlServer' PowerShell module was not found. Install it with: Install-Module SqlServer -Scope CurrentUser"
}

# SQL Server returns typed values; use invariant culture so dates/numbers are
# exported in a predictable format (yyyy-MM-dd / 1234.56).
$previousCulture = [System.Threading.Thread]::CurrentThread.CurrentCulture
[System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::InvariantCulture

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$connection = @{
    ServerInstance = $ServerInstance
    Database       = $Database
    QueryTimeout   = $QueryTimeout
}
if ($User) {
    $connection.Username = $User
    $connection.Password = $Password
    $connection.TrustServerCertificate = $true
}

function Invoke-Query([string]$sql) {
    Invoke-Sqlcmd @connection -Query $sql -ErrorAction Stop
}

Write-Host "Reading table list from [$Database] on [$ServerInstance] ..."
$allTables = Invoke-Query @"
SELECT TABLE_SCHEMA AS [schema], TABLE_NAME AS [table]
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_SCHEMA, TABLE_NAME
"@

if ($Tables.Count -gt 0) {
    $allTables = $allTables | Where-Object { $Tables -contains $_.table }
}

if (-not $allTables) {
    throw "No tables found (or none matched -Tables)."
}

$manifest = @()
$index = 0
foreach ($t in $allTables) {
    $index++
    $schema = $t.schema
    $name = $t.table
    $fileName = if ($schema -eq "dbo") { "$name.csv" } else { "$schema.$name.csv" }
    $path = Join-Path $OutputDir $fileName

    Write-Host ("[{0}/{1}] {2}.{3} -> {4}" -f $index, $allTables.Count, $schema, $name, $fileName)

    $columns = Invoke-Query @"
SELECT COLUMN_NAME AS [name], DATA_TYPE AS [type], IS_NULLABLE AS [nullable]
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = N'$schema' AND TABLE_NAME = N'$name'
ORDER BY ORDINAL_POSITION
"@

    $rows = Invoke-Query "SELECT * FROM [$schema].[$name]"

    if ($null -eq $rows) {
        # No rows: still write the header so the importer knows the columns.
        $header = ($columns | ForEach-Object { '"' + $_.name + '"' }) -join ","
        Set-Content -Path $path -Value $header -Encoding UTF8
    } else {
        $rows | Export-Csv -Path $path -NoTypeInformation -Encoding UTF8
    }

    $manifest += [pscustomobject]@{
        schema  = $schema
        table   = $name
        file    = $fileName
        columns = @($columns | ForEach-Object { $_.name })
    }
}

$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $OutputDir "_manifest.json") -Encoding UTF8
[System.Threading.Thread]::CurrentThread.CurrentCulture = $previousCulture

Write-Host ""
Write-Host "Done. Export folder: $([System.IO.Path]::GetFullPath($OutputDir))"
Write-Host "Copy this folder into the project and run:"
Write-Host "  cd backend"
Write-Host "  python manage.py mssql_import --source ..\mssql_export --analyze"
