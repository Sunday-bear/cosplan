#!/usr/bin/env python3
import httpx, json

# Test cosplan.top (should be 200 with frontend HTML)
r = httpx.get("https://cosplan.top", verify=False, follow_redirects=True, timeout=10)
print("cosplan.top: " + str(r.status_code) + " (len=" + str(len(r.text)) + ")")
print("  Has face-api.min.js ref: " + str("face-api.min.js" in r.text))
print("  Has search POST: " + str("/search" in r.text))

# Test health
r = httpx.get("https://cosplan.top/health", verify=False, timeout=10)
print("/health: " + str(r.status_code))
print("  body: " + r.text[:100])

# Test search
r = httpx.post("https://cosplan.top/search", json={"character": "初音ミク", "count": 1}, verify=False, timeout=20)
data = r.json()
print("/search: " + str(r.status_code) + " | success=" + str(data.get("success")))

# Test SSL certificate chain
import ssl, socket
ctx = ssl.create_default_context()
try:
    with socket.create_connection(("cosplan.top", 443), timeout=10) as sock:
        with ctx.wrap_socket(sock, server_hostname="cosplan.top") as ssock:
            cert = ssock.getpeercert()
            print("SSL: cosplan.top matches cosplan.top - OK!")
            print("  Issuer: " + str(cert.get("issuer")))
            print("  Expiry: " + str(cert.get("notAfter")))
except Exception as e:
    print("SSL error: " + str(e))
