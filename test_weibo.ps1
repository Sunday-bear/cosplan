$url = "https://m.weibo.cn/api/container/getIndex?containerid=100103type%3D1%26q%3D%e8%95%be%e5%a7%86%20cos&page=1"
$wc = New-Object System.Net.WebClient
$wc.Headers.Add("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)")
$wc.Headers.Add("Referer", "https://m.weibo.cn/")
$r = $wc.DownloadString($url)
$len = [Math]::Min(2000, $r.Length)
Write-Host $r.Substring(0, $len)
