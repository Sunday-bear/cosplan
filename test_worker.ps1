$wc = New-Object System.Net.WebClient

# Test root
Write-Host "=== Root ==="
$r = $wc.DownloadString("https://cosplan-api.15913625621.workers.dev/")
Write-Host $r

# Test search
Write-Host "=== Search: 蕾姆 ==="
$r = $wc.DownloadString("https://cosplan-api.15913625621.workers.dev/search?q=蕾姆+cos")
Write-Host $r

Write-Host "Done"
