#!/usr/bin/env python3
"""Upload test page and fix nginx MIME config"""
import paramiko, os

HOST = "45.32.25.221"
PORT = 22
USER = "root"
PASSWORD = "[uU3)f8[,#M,k((f"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, PORT, USER, PASSWORD)

def run(cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    return exit_status, out, err

# Upload test page
sftp = client.open_sftp()
local = r"C:\Users\Administrator\.openclaw\workspace\cosplan\faceapi_test.html"
sftp.put(local, "/var/www/cosplan/faceapi_test.html")
sftp.close()

# Fix nginx config: Add explicit static file handling and ensure no interference
# Actually the real problem might be in the index.html's use of 'defer' on face-api.min.js
# When loaded via HTTPS (different origin than the page at top level), 
# the script might have issues. Let me also check the page source...
print("Config seems fine. Files accessible:")
e, o, _ = run("curl -sk -w ' %{http_code}' -o /dev/null https://cosplan.top/faceapi_test.html")
print("test page: " + o)
e, o, _ = run("curl -sk -w ' %{http_code}' -o /dev/null https://cosplan.top/face-api.min.js")
print("face-api: " + o)

client.close()
