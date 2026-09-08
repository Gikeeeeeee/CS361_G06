<#
.SYNOPSIS
    Smoke-tests the deployed CS361_G06 building API (all 5 endpoints + error paths).

.DESCRIPTION
    Run this after `terraform apply`. It discovers the API URL from the Terraform
    output, then walks the API: buildings -> a building -> a floor -> a room and a
    facility, so it uses whatever data is actually in your bucket instead of
    hard-coded ids.

    Checks performed:
      1.  GET /api/v1/buildings                                   -> 200 + non-empty list
      2.  GET /api/v1/buildings/{id}                              -> 200 + summary shape
      3.  GET /api/v1/buildings/{id} with a lowercase id          -> 200 (case-insensitive)
      4.  GET /api/v1/buildings/NOPE                              -> 404 BUILDING_NOT_FOUND
      5.  GET .../floors/{floor_number}                           -> 200 + map/rooms/facilities
      6.  GET .../floors/{floor uuid}                             -> 200, same floor
      7.  GET .../floors/9999                                     -> 404 FLOOR_NOT_FOUND
      8.  the floor's presigned SVG URL                           -> downloadable
      9.  GET .../rooms/{roomId}                                  -> 200
      10. GET .../rooms/NOPE                                      -> 404 ROOM_NOT_FOUND
      11. GET .../facilities/{facilityId}                         -> 200
      12. GET .../facilities/NOPE                                 -> 404 FACILITY_NOT_FOUND
      13. GET /api/v1/health (undeclared route)                   -> 404
      14. CORS header present on a normal response
      15. OPTIONS preflight                                       -> informational

    Exit code is 0 when everything passed, 1 otherwise (usable in CI).

.PARAMETER BaseUrl
    API root, e.g. https://abc123.execute-api.us-east-1.amazonaws.com
    Omit it and the script runs `terraform output -raw api_endpoint`.
    A URL that already ends in /api/v1 is accepted too.

.PARAMETER BuildingId
    Building to exercise. Default: the first one the API returns.

.PARAMETER TerraformDir
    Where to run `terraform output`. Default: the `terraform` folder next to this script.

.PARAMETER JsonOut
    Optional path to write the full results as JSON.

.EXAMPLE
    .\test-api.ps1

.EXAMPLE
    .\test-api.ps1 -BaseUrl https://abc123.execute-api.us-east-1.amazonaws.com -BuildingId LC4

.NOTES
    Works on PowerShell 7+ and Windows PowerShell 5.1.
    Expects the refactored backend (issues #43 / #49): errors come back as
    {"error":{"code":"...","message":"..."}}.
#>

[CmdletBinding()]
param(
    [string] $BaseUrl,
    [string] $BuildingId,
    [string] $TerraformDir,
    [string] $JsonOut
)

if (-not $TerraformDir) {
    $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
    $TerraformDir = Join-Path $scriptDir 'terraform'
}

$ErrorActionPreference = 'Stop'
$IsPS7 = $PSVersionTable.PSVersion.Major -ge 6

if (-not $IsPS7) {
    # Windows PowerShell 5.1 still defaults to TLS 1.0 in some setups.
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
}

# ---------------------------------------------------------------------------
# Result tracking
# ---------------------------------------------------------------------------

$script:Results = New-Object System.Collections.ArrayList

function Add-Result {
    param(
        [string] $Name,
        [string] $Outcome,   # PASS | FAIL | SKIP | WARN
        [string] $Detail,
        $Status
    )

    [void]$script:Results.Add([pscustomobject]@{
        Name    = $Name
        Outcome = $Outcome
        Status  = $Status
        Detail  = $Detail
    })

    $colour = switch ($Outcome) {
        'PASS' { 'Green' }
        'FAIL' { 'Red' }
        'WARN' { 'Yellow' }
        default { 'DarkGray' }
    }

    $statusText = if ($null -ne $Status) { "$Status".PadLeft(3) } else { '  -' }
    Write-Host ("  [{0}] {1}  {2}" -f $Outcome.PadRight(4), $statusText, $Name) -ForegroundColor $colour

    if ($Detail) {
        Write-Host ("         {0}" -f $Detail) -ForegroundColor DarkGray
    }
}

# ---------------------------------------------------------------------------
# HTTP helper -- never throws on 4xx/5xx, works on both PowerShell editions
# ---------------------------------------------------------------------------

function Invoke-Api {
    param(
        [string] $Url,
        [string] $Method = 'GET',
        [hashtable] $Headers = @{}
    )

    $result = [pscustomobject]@{
        Url     = $Url
        Status  = $null
        Body    = $null
        Json    = $null
        Headers = @{}
        Error   = $null
    }

    try {
        if ($IsPS7) {
            $response = Invoke-WebRequest -Uri $Url -Method $Method -Headers $Headers `
                -SkipHttpErrorCheck -TimeoutSec 30
        }
        else {
            $response = Invoke-WebRequest -Uri $Url -Method $Method -Headers $Headers `
                -UseBasicParsing -TimeoutSec 30
        }

        $result.Status = [int]$response.StatusCode
        $result.Body = $response.Content

        foreach ($key in $response.Headers.Keys) {
            $result.Headers[$key] = ($response.Headers[$key] -join ', ')
        }
    }
    catch {
        # Windows PowerShell 5.1 throws a WebException on any 4xx/5xx, and PS7
        # does the same if -SkipHttpErrorCheck is unavailable. Both carry the
        # response; the body is reached differently on each, so try both.
        $failed = $_.Exception.Response

        if ($failed) {
            try { $result.Status = [int]$failed.StatusCode } catch { }

            if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
                $result.Body = $_.ErrorDetails.Message           # PS7
            }
            elseif ($failed.PSObject.Methods.Name -contains 'GetResponseStream') {
                $reader = New-Object System.IO.StreamReader($failed.GetResponseStream())
                $result.Body = $reader.ReadToEnd()               # 5.1
                $reader.Close()
            }

            try {
                if ($failed.Headers.AllKeys) {
                    foreach ($key in $failed.Headers.AllKeys) {
                        $result.Headers[$key] = $failed.Headers[$key]
                    }
                }
            }
            catch { }
        }
        else {
            $result.Error = $_.Exception.Message
        }
    }

    if ($result.Body) {
        try { $result.Json = $result.Body | ConvertFrom-Json } catch { }
    }

    return $result
}

function Test-WhoAnswered {
    <#
        Distinguishes "your Lambda replied" from "API Gateway replied on its own".

        The Lambda sets Access-Control-Allow-Origin on every response and shapes
        failures as {"error":{"code":...}}. API Gateway's own 404 is a bare
        {"message":"Not Found"} with no CORS header. Telling them apart turns a
        wall of red into one specific cause.
    #>
    param($Response)

    foreach ($key in $Response.Headers.Keys) {
        if ($key -ieq 'Access-Control-Allow-Origin') { return 'lambda' }
    }

    if ($Response.Json) {
        $fields = $Response.Json.PSObject.Properties.Name

        if ($fields -contains 'error') { return 'lambda' }
        if ($fields -contains 'message' -and -not ($fields -contains 'error')) {
            return 'apigateway'
        }
    }

    return 'unknown'
}

function Get-ErrorCode {
    param($Response)

    if ($Response.Json -and $Response.Json.error) {
        # refactored backend: {"error":{"code":"...","message":"..."}}
        if ($Response.Json.error.PSObject.Properties.Name -contains 'code') {
            return $Response.Json.error.code
        }
        return '(flat error string)'
    }

    return $null
}

# ---------------------------------------------------------------------------
# Resolve the base URL
# ---------------------------------------------------------------------------

Write-Host ''
Write-Host 'CS361_G06 - API smoke test' -ForegroundColor Cyan
Write-Host ('=' * 60) -ForegroundColor DarkGray

if (-not $BaseUrl) {
    if (-not (Test-Path $TerraformDir)) {
        Write-Host "Terraform directory not found: $TerraformDir" -ForegroundColor Red
        Write-Host 'Pass the URL directly:  .\test-api.ps1 -BaseUrl https://xxx.execute-api.us-east-1.amazonaws.com'
        exit 1
    }

    Write-Host "Reading api_endpoint from Terraform ($TerraformDir)..." -ForegroundColor DarkGray

    try {
        $BaseUrl = (terraform -chdir="$TerraformDir" output -raw api_endpoint 2>$null)
    }
    catch {
        $BaseUrl = $null
    }

    if (-not $BaseUrl) {
        Write-Host 'Could not read the Terraform output "api_endpoint".' -ForegroundColor Red
        Write-Host 'Run `terraform apply` first, or pass -BaseUrl explicitly.'
        exit 1
    }
}

$root = $BaseUrl.TrimEnd('/')

if ($root -notmatch '/api/v1$') {
    $root = "$root/api/v1"
}

Write-Host "Base URL : $root"
Write-Host "PowerShell: $($PSVersionTable.PSVersion)"
Write-Host ''

# ---------------------------------------------------------------------------
# 1. List buildings  (also discovers the building to use)
# ---------------------------------------------------------------------------

Write-Host 'Buildings' -ForegroundColor Cyan

$listing = Invoke-Api "$root/buildings" 'GET' @{ 'Origin' = 'http://localhost:5173' }

if ($listing.Error) {
    Add-Result 'GET /buildings' 'FAIL' "request failed: $($listing.Error)" $null
    Write-Host ''
    Write-Host 'Cannot reach the API - stopping.' -ForegroundColor Red
    exit 1
}

# Before running 15 checks that would all fail for the same reason, work out
# whether the Lambda is being reached at all.
$responder = Test-WhoAnswered $listing

if ($responder -eq 'apigateway') {
    Add-Result 'GET /buildings' 'FAIL' `
        "API Gateway answered, not your Lambda. Raw body: $($listing.Body)" $listing.Status

    Write-Host ''
    Write-Host ('=' * 60) -ForegroundColor DarkGray
    Write-Host 'DIAGNOSIS: no route matched, so the Lambda never ran.' -ForegroundColor Red
    Write-Host ''
    Write-Host 'The response has no Access-Control-Allow-Origin header and no "error"' -ForegroundColor Yellow
    Write-Host 'object, so it came from API Gateway itself. Your backend code is not' -ForegroundColor Yellow
    Write-Host 'the problem here - the routes or the integration are missing.' -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'Check what actually got deployed:' -ForegroundColor Cyan
    Write-Host ''

    $apiId = ([uri]$root).Host.Split('.')[0]

    Write-Host "  terraform -chdir=`"$TerraformDir`" state list | Select-String route,lambda"
    Write-Host "  aws apigatewayv2 get-routes --api-id $apiId --query `"Items[].RouteKey`" --output table"
    Write-Host "  aws apigatewayv2 get-stages --api-id $apiId --query `"Items[].StageName`" --output table"
    Write-Host ''
    Write-Host 'If the route list is empty, the apply did not finish. Re-run it and' -ForegroundColor Cyan
    Write-Host 'read the tail of the output for the error:' -ForegroundColor Cyan
    Write-Host ''
    Write-Host "  terraform -chdir=`"$TerraformDir`" apply"
    Write-Host ''
    Write-Host 'In AWS Academy Learner Lab, credentials expire after a few hours -' -ForegroundColor DarkGray
    Write-Host 'a mid-apply expiry leaves exactly this half-built state. Refresh them' -ForegroundColor DarkGray
    Write-Host 'and apply again.' -ForegroundColor DarkGray
    Write-Host ''

    exit 1
}

if ($listing.Status -eq 200 -and $listing.Json -and $listing.Json.buildings.Count -gt 0) {
    Add-Result 'GET /buildings' 'PASS' `
        "$($listing.Json.buildings.Count) building(s): $(($listing.Json.buildings | ForEach-Object { $_.id }) -join ', ')" `
        $listing.Status
}
else {
    Add-Result 'GET /buildings' 'FAIL' `
        'expected 200 with a non-empty "buildings" array' $listing.Status
}

if (-not $BuildingId) {
    if ($listing.Json -and $listing.Json.buildings.Count -gt 0) {
        $BuildingId = $listing.Json.buildings[0].id
    }
    else {
        $BuildingId = 'LC4'
        Write-Host '  (no buildings discovered - falling back to LC4)' -ForegroundColor Yellow
    }
}

Write-Host "  using buildingId = $BuildingId" -ForegroundColor DarkGray

# ---------------------------------------------------------------------------
# 2-4. Building detail
# ---------------------------------------------------------------------------

$building = Invoke-Api "$root/buildings/$BuildingId"
$requiredFields = @('id', 'name', 'latitude', 'longitude', 'floors')

if ($building.Status -eq 200 -and $building.Json) {
    $present = $building.Json.PSObject.Properties.Name
    $missing = $requiredFields | Where-Object { $present -notcontains $_ }

    if ($missing) {
        Add-Result "GET /buildings/$BuildingId" 'FAIL' `
            "missing field(s): $($missing -join ', ')" $building.Status
    }
    else {
        Add-Result "GET /buildings/$BuildingId" 'PASS' `
            "$($building.Json.name), $($building.Json.floors.Count) floor(s)" $building.Status
    }
}
else {
    Add-Result "GET /buildings/$BuildingId" 'FAIL' 'expected 200 with a building summary' $building.Status
}

$lower = Invoke-Api "$root/buildings/$($BuildingId.ToLower())"

if ($lower.Status -eq 200) {
    Add-Result 'building id is case-insensitive' 'PASS' "tried '$($BuildingId.ToLower())'" $lower.Status
}
else {
    Add-Result 'building id is case-insensitive' 'FAIL' 'lowercase id should resolve too' $lower.Status
}

$noBuilding = Invoke-Api "$root/buildings/ZZZ-does-not-exist"
$code = Get-ErrorCode $noBuilding

if ($noBuilding.Status -eq 404 -and $code -eq 'BUILDING_NOT_FOUND') {
    Add-Result 'unknown building -> 404' 'PASS' "error.code = $code" $noBuilding.Status
}
elseif ($noBuilding.Status -eq 404) {
    Add-Result 'unknown building -> 404' 'WARN' `
        "status is right but error.code = '$code' (expected BUILDING_NOT_FOUND)" $noBuilding.Status
}
else {
    Add-Result 'unknown building -> 404' 'FAIL' 'expected 404' $noBuilding.Status
}

# ---------------------------------------------------------------------------
# 5-8. Floor detail
# ---------------------------------------------------------------------------

Write-Host ''
Write-Host 'Floors' -ForegroundColor Cyan

$floorNumber = $null
$floorUuid = $null

if ($building.Json -and $building.Json.floors.Count -gt 0) {
    $floorNumber = $building.Json.floors[0].floor_number
    $floorUuid = $building.Json.floors[0].id
}

$floor = $null

if ($null -eq $floorNumber) {
    Add-Result 'GET .../floors/{floor_number}' 'SKIP' 'no floors on this building' $null
}
else {
    $floor = Invoke-Api "$root/buildings/$BuildingId/floors/$floorNumber"

    if ($floor.Status -eq 200 -and $floor.Json.map -and $floor.Json.map.url) {
        Add-Result "GET .../floors/$floorNumber" 'PASS' `
            "$($floor.Json.rooms.Count) room(s), $($floor.Json.facilities.Count) facility(ies)" `
            $floor.Status
    }
    else {
        Add-Result "GET .../floors/$floorNumber" 'FAIL' `
            'expected 200 with map.url, rooms and facilities' $floor.Status
    }

    $byUuid = Invoke-Api "$root/buildings/$BuildingId/floors/$floorUuid"

    if ($byUuid.Status -eq 200 -and $byUuid.Json.id -eq $floorUuid) {
        Add-Result 'floor addressable by uuid' 'PASS' "id = $floorUuid" $byUuid.Status
    }
    else {
        Add-Result 'floor addressable by uuid' 'FAIL' `
            'the same floor should resolve by its uuid' $byUuid.Status
    }
}

$noFloor = Invoke-Api "$root/buildings/$BuildingId/floors/9999"
$code = Get-ErrorCode $noFloor

if ($noFloor.Status -eq 404 -and $code -eq 'FLOOR_NOT_FOUND') {
    Add-Result 'unknown floor -> 404' 'PASS' "error.code = $code" $noFloor.Status
}
elseif ($noFloor.Status -eq 404) {
    Add-Result 'unknown floor -> 404' 'WARN' `
        "status is right but error.code = '$code' (expected FLOOR_NOT_FOUND)" $noFloor.Status
}
else {
    Add-Result 'unknown floor -> 404' 'FAIL' 'expected 404' $noFloor.Status
}

# The presigned URL is the part most likely to break (IAM / bucket / key naming),
# so actually fetch it.
if ($floor -and $floor.Json.map.url) {
    $svg = Invoke-Api $floor.Json.map.url

    if ($svg.Status -eq 200) {
        Add-Result 'presigned SVG map downloads' 'PASS' `
            "$($svg.Body.Length) bytes" $svg.Status
    }
    else {
        Add-Result 'presigned SVG map downloads' 'FAIL' `
            'the map URL did not return 200 - check the S3 key and IAM read policy' $svg.Status
    }
}
else {
    Add-Result 'presigned SVG map downloads' 'SKIP' 'no map url to test' $null
}

# ---------------------------------------------------------------------------
# 9-12. Rooms and facilities
# ---------------------------------------------------------------------------

Write-Host ''
Write-Host 'Rooms and facilities' -ForegroundColor Cyan

$roomId = $null
$facilityId = $null

if ($floor -and $floor.Json) {
    if ($floor.Json.rooms.Count -gt 0) { $roomId = $floor.Json.rooms[0].id }
    if ($floor.Json.facilities.Count -gt 0) { $facilityId = $floor.Json.facilities[0].id }
}

if (-not $roomId) {
    Add-Result 'GET .../rooms/{roomId}' 'SKIP' 'no rooms on this floor' $null
}
else {
    $room = Invoke-Api "$root/buildings/$BuildingId/floors/$floorNumber/rooms/$roomId"

    if ($room.Status -eq 200 -and $room.Json.id -eq $roomId) {
        Add-Result "GET .../rooms/$roomId" 'PASS' `
            "$($room.Json.name) ($($room.Json.type))" $room.Status
    }
    else {
        Add-Result "GET .../rooms/$roomId" 'FAIL' 'expected 200 with the room record' $room.Status
    }

    $noRoom = Invoke-Api "$root/buildings/$BuildingId/floors/$floorNumber/rooms/ZZZ"
    $code = Get-ErrorCode $noRoom

    if ($noRoom.Status -eq 404 -and $code -eq 'ROOM_NOT_FOUND') {
        Add-Result 'unknown room -> 404' 'PASS' "error.code = $code" $noRoom.Status
    }
    elseif ($noRoom.Status -eq 404) {
        Add-Result 'unknown room -> 404' 'WARN' `
            "status is right but error.code = '$code' (expected ROOM_NOT_FOUND)" $noRoom.Status
    }
    else {
        Add-Result 'unknown room -> 404' 'FAIL' 'expected 404' $noRoom.Status
    }
}

if (-not $facilityId) {
    Add-Result 'GET .../facilities/{facilityId}' 'SKIP' 'no facilities on this floor' $null
}
else {
    $facility = Invoke-Api "$root/buildings/$BuildingId/floors/$floorNumber/facilities/$facilityId"

    if ($facility.Status -eq 200 -and $facility.Json.id -eq $facilityId) {
        Add-Result "GET .../facilities/$facilityId" 'PASS' `
            "$($facility.Json.name) ($($facility.Json.type))" $facility.Status
    }
    else {
        Add-Result "GET .../facilities/$facilityId" 'FAIL' `
            'expected 200 with the facility record' $facility.Status
    }

    $noFacility = Invoke-Api "$root/buildings/$BuildingId/floors/$floorNumber/facilities/ZZZ"
    $code = Get-ErrorCode $noFacility

    if ($noFacility.Status -eq 404 -and $code -eq 'FACILITY_NOT_FOUND') {
        Add-Result 'unknown facility -> 404' 'PASS' "error.code = $code" $noFacility.Status
    }
    elseif ($noFacility.Status -eq 404) {
        Add-Result 'unknown facility -> 404' 'WARN' `
            "status is right but error.code = '$code' (expected FACILITY_NOT_FOUND)" $noFacility.Status
    }
    else {
        Add-Result 'unknown facility -> 404' 'FAIL' 'expected 404' $noFacility.Status
    }
}

# ---------------------------------------------------------------------------
# 13-15. Routing and CORS
# ---------------------------------------------------------------------------

Write-Host ''
Write-Host 'Routing and CORS' -ForegroundColor Cyan

$unknown = Invoke-Api "$root/health"

if ($unknown.Status -eq 404) {
    Add-Result 'undeclared route -> 404' 'PASS' `
        "error.code = $(Get-ErrorCode $unknown)" $unknown.Status
}
else {
    Add-Result 'undeclared route -> 404' 'FAIL' `
        'an undeclared path should be 404, never 500' $unknown.Status
}

$corsHeader = $null

foreach ($key in $listing.Headers.Keys) {
    if ($key -ieq 'Access-Control-Allow-Origin') { $corsHeader = $listing.Headers[$key] }
}

if ($corsHeader) {
    Add-Result 'CORS header on responses' 'PASS' "Access-Control-Allow-Origin: $corsHeader" $null
}
else {
    Add-Result 'CORS header on responses' 'FAIL' `
        'Access-Control-Allow-Origin missing - the frontend will be blocked' $null
}

$preflight = Invoke-Api "$root/buildings" 'OPTIONS' @{
    'Origin'                         = 'http://localhost:5173'
    'Access-Control-Request-Method'  = 'GET'
    'Access-Control-Request-Headers' = 'content-type'
}

if ($preflight.Status -in 200, 204) {
    Add-Result 'CORS preflight (OPTIONS)' 'PASS' 'handled by API Gateway CORS config' $preflight.Status
}
else {
    Add-Result 'CORS preflight (OPTIONS)' 'WARN' `
        'preflight did not return 200/204 - browsers may block cross-origin calls' $preflight.Status
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

$passed = @($script:Results | Where-Object Outcome -eq 'PASS').Count
$failed = @($script:Results | Where-Object Outcome -eq 'FAIL').Count
$warned = @($script:Results | Where-Object Outcome -eq 'WARN').Count
$skipped = @($script:Results | Where-Object Outcome -eq 'SKIP').Count

Write-Host ''
Write-Host ('=' * 60) -ForegroundColor DarkGray
Write-Host ("{0} passed, {1} failed, {2} warning(s), {3} skipped" -f $passed, $failed, $warned, $skipped) `
    -ForegroundColor $(if ($failed) { 'Red' } else { 'Green' })

if ($failed) {
    Write-Host ''
    Write-Host 'Failed checks:' -ForegroundColor Red
    $script:Results | Where-Object Outcome -eq 'FAIL' | ForEach-Object {
        Write-Host ("  - {0} (status {1}): {2}" -f $_.Name, $_.Status, $_.Detail) -ForegroundColor Red
    }
}

if ($JsonOut) {
    $script:Results | ConvertTo-Json -Depth 5 | Set-Content -Path $JsonOut -Encoding UTF8
    Write-Host ''
    Write-Host "Results written to $JsonOut" -ForegroundColor DarkGray
}

Write-Host ''
exit $(if ($failed) { 1 } else { 0 })
