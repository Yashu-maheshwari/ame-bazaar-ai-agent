# Portable n8n Auto-Start script for AME Bazaar AI Agent
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectPath = Resolve-Path "$scriptDir\.."
$envPath = "$projectPath\.env"

if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        $parts = $_.Split('=', 2)
        if ($parts.Length -eq 2) {
            $name = $parts[0].Trim()
            $value = $parts[1].Trim().Trim('"')
            if ($name) {
                [Environment]::SetEnvironmentVariable($name, $value, 'Process')
            }
        }
    }
}

$env:N8N_ENVS_MODE="nodes"
$env:N8N_BLOCK_ENV_ACCESS_IN_NODE="false"
$env:N8N_PORT="5678"
$env:N8N_WEBHOOK_URL="http://localhost:5678"

Set-Location $projectPath
npx n8n start
