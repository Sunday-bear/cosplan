$ErrorActionPreference = "Stop"
$token = "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"
$owner = "Sunday-bear"
$repo = "cosplan"
$branch = "main"
$api = "https://api.github.com/repos/$owner/$repo/contents"

$files_to_upload = @("index.html", "worker.js")

function Upload-File($localPath, $remotePath) {
    Write-Host "Uploading $localPath -> $remotePath ..."
    $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path $localPath)))
    
    # Try to get existing file SHA for update
    $sha = $null
    try {
        $existing = Invoke-RestMethod -Uri "$api/$remotePath" -Headers @{
            Authorization = "token $token"
            "User-Agent" = "cosplan-bot"
        }
        $sha = $existing.sha
        Write-Host "  Existing SHA: $sha (will update)"
    } catch {
        Write-Host "  New file (no existing SHA)"
    }
    
    $body = @{
        message = "v2: live cosplay search via Worker API + proxy"
        branch = $branch
        content = $b64
        committer = @{
            name = "Jarvis Bot"
            email = "jarvis@cosplan.top"
        }
    }
    if ($sha) { $body.sha = $sha }
    
    $json = $body | ConvertTo-Json -Depth 5
    $result = Invoke-RestMethod -Uri "$api/$remotePath" -Method PUT -Headers @{
        Authorization = "token $token"
        "User-Agent" = "cosplan-bot"
    } -Body $json -ContentType "application/json"
    
    Write-Host "  ✅ $remotePath uploaded (SHA: $($result.content.sha))"
}

cd C:\Users\Administrator\.openclaw\workspace\cosplan

Upload-File "index.html" "index.html"
Upload-File "worker.js" "worker.js"

Write-Host ""
Write-Host "🎉 Deploy complete! GitHub Pages will update in ~1-2 minutes."
Write-Host "📦 Site: https://sunday-bear.github.io/cosplan/"
Write-Host "🌐 Domain: https://cosplan.top"
