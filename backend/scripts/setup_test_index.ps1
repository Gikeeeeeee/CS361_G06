param(
    [string]$Endpoint = ""
)

$ErrorActionPreference = "Stop"

$region = "ap-southeast-2"
$tableName = "CS361-G06-data-dynamodb"
$indexName = "university-test"

Write-Host "========================================"
Write-Host " 1. Finding OpenSearch Collection Endpoint..."
Write-Host "========================================"

if (-not $Endpoint) {
    try {
        $collectionsRaw = aws opensearchserverless list-collections --region $region
        if ($collectionsRaw) {
            $collections = $collectionsRaw | ConvertFrom-Json
            $match = $collections.collectionSummaries | Where-Object { $_.name -eq "faculty-search" } | Select-Object -First 1
            if (-not $match) {
                $match = $collections.collectionSummaries | Select-Object -First 1
            }
            if ($match) {
                $detailsRaw = aws opensearchserverless batch-get-collection --ids $match.id --region $region
                if ($detailsRaw) {
                    $details = $detailsRaw | ConvertFrom-Json
                    $Endpoint = $details.collectionDetails[0].collectionEndpoint
                }
            }
        }
    } catch {
        Write-Warning "Could not fetch collections via AWS CLI automatically: $_"
    }
}

if (-not $Endpoint) {
    Write-Error "OpenSearch Endpoint not found. Please provide it as an argument: .\setup_test_index.ps1 -Endpoint https://xxxx.ap-southeast-2.aoss.amazonaws.com"
    exit 1
}

Write-Host "Using Endpoint: $Endpoint"

$env:AWS_REGION = $region
$env:AWS_DEFAULT_REGION = $region
$env:DYNAMODB_TABLE_NAME = $tableName
$env:OPENSEARCH_INDEX = $indexName
$env:OPENSEARCH_ENDPOINT = $Endpoint

Write-Host "========================================"
Write-Host " 2. Ensuring required Python packages..."
Write-Host "========================================"
py -m pip install -q boto3 opensearch-py requests

Write-Host "========================================"
Write-Host " 3. Running reindex.py..."
Write-Host "========================================"
py backend/scripts/reindex.py

Write-Host "========================================"
Write-Host " Done!"
Write-Host "========================================"
