#!/usr/bin/env python3
"""Test face-api model loading and fix issues on VPS"""
import paramiko
import os

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

# Check model files on VPS
print("Model files on VPS:")
e, o, _ = run("ls -la /var/www/cosplan/models/")
print(o)

# Check if face-api.min.js is present
e, o, _ = run("ls -la /var/www/cosplan/face-api.min.js")
print("face-api.min.js:", o)

# Check nginx serving these files correctly
e, o, _ = run("curl -s -o /dev/null -w '%{http_code}' http://localhost/face-api.min.js")
print("nginx serving face-api:", o)

e, o, _ = run("curl -s -o /dev/null -w '%{http_code}' http://localhost/models/tiny_face_detector_model-weights_manifest.json")
print("nginx serving models:", o)

# The issue might be CORS or content-type for .js files - check nginx config
print("\nNginx config:")
e, o, _ = run("cat /etc/nginx/sites-available/cosplan-api")
print(o)

client.close()
