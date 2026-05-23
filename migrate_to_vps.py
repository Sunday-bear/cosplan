#!/usr/bin/env python3
"""Upload frontend files to VPS and configure Nginx to serve cosplan.top directly"""
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

# Step 1: Create web directory on VPS
print("1. Creating web directory...")
run("mkdir -p /var/www/cosplan/models")
run("mkdir -p /var/www/cosplan/images/characters")

# Step 2: Upload files via SFTP
print("2. Uploading frontend files...")
sftp = client.open_sftp()

# Files to upload
local_base = r"C:\Users\Administrator\.openclaw\workspace\cosplan"
uploads = [
    ("index.html", "/var/www/cosplan/index.html"),
    ("face-api.min.js", "/var/www/cosplan/face-api.min.js"),
]
for local_name, remote_path in uploads:
    local_path = os.path.join(local_base, local_name)
    if os.path.exists(local_path):
        sftp.put(local_path, remote_path)
        print(f"  Uploaded: {local_name}")

# Check if models directory has files
import glob
model_files = glob.glob(os.path.join(local_base, "models", "*"))
if model_files:
    for mf in model_files:
        basename = os.path.basename(mf)
        sftp.put(mf, f"/var/www/cosplan/models/{basename}")
        print(f"  Uploaded model: {basename}")
else:
    print("  WARNING: No model files found in models/ directory!")

# Check character images
char_img_files = glob.glob(os.path.join(local_base, "images", "characters", "*"))
if char_img_files:
    for cf in char_img_files[:10]:  # first 10 for now
        basename = os.path.basename(cf)
        sftp.put(cf, f"/var/www/cosplan/images/characters/{basename}")
        print(f"  Uploaded char img: {basename}")
    if len(char_img_files) > 10:
        print(f"  ... and {len(char_img_files) - 10} more")

sftp.close()

# Step 3: Write Nginx config for cosplan.top serving frontend + API
print("\n3. Writing Nginx config...")
nginx_conf = """# cosplan.top - Frontend
server {
    listen 80;
    server_name cosplan.top www.cosplan.top;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cosplan.top www.cosplan.top;

    ssl_certificate /etc/nginx/ssl/cosplan.top.crt;
    ssl_certificate_key /etc/nginx/ssl/cosplan.top.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /var/www/cosplan;
    index index.html;

    # Frontend static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Models (face-api weights) - long cache
    location /models/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API requests -> FastAPI backend
    location /search {
        proxy_pass http://127.0.0.1:8000/search;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# api.cosplan.top - keep for backward compat / direct API access
server {
    listen 80;
    server_name api.cosplan.top;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.cosplan.top;

    ssl_certificate /etc/nginx/ssl/api.cosplan.top.crt;
    ssl_certificate_key /etc/nginx/ssl/api.cosplan.top.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
"""

stdin, stdout, stderr = client.exec_command("cat > /etc/nginx/sites-available/cosplan-api", timeout=10)
stdin.write(nginx_conf)
stdin.channel.shutdown_write()
stdout.channel.recv_exit_status()

# Test config
print("4. Testing Nginx config...")
run("nginx -t")

# Reload nginx
print("5. Reloading Nginx...")
run("systemctl reload nginx || systemctl restart nginx")

# Verify
print("6. Verifying...")
e, o, _ = run("curl -sk -w ' HTTP:%{http_code}' -o /dev/null https://cosplan.top/")
print(f"  cosplan.top: {o}")
e, o, _ = run("curl -sk -w ' HTTP:%{http_code}' -o /dev/null https://cosplan.top/index.html")
print(f"  index.html: {o}")
e, o, _ = run("curl -sk -w ' HTTP:%{http_code}' -o /dev/null https://api.cosplan.top/health")
print(f"  api.cosplan.top: {o}")

client.close()
print("\n✅ Done! Frontend + API served from same VPS")
