"""Add cosplan.top to VPS Nginx: redirect to www.cosplan.top (GitHub Pages)"""
import paramiko

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

# Get SSL cert for cosplan.top AND api.cosplan.top (multi-domain)
# Stop nginx, issue cert with both domains, restart
print("1. Stopping Nginx...")
run("systemctl stop nginx")

# Issue cert for both domains (multi-SAN)
print("2. Issuing SSL cert for cosplan.top + api.cosplan.top...")
exit_status, out, err = run(
    "~/.acme.sh/acme.sh --issue -d cosplan.top -d api.cosplan.top --standalone --force 2>&1",
    timeout=120
)
print(out[:500])
if err:
    print(f"  stderr: {err[:200]}")

# Fix: register email first if needed
if exit_status != 0 and 'email' in out.lower():
    run("~/.acme.sh/acme.sh --register-account -m sunday.cosplan@gmail.com --force 2>&1")
    exit_status, out, err = run(
        "~/.acme.sh/acme.sh --issue -d cosplan.top -d api.cosplan.top --standalone --force 2>&1",
        timeout=120
    )
    print(out[:500])

# Write new Nginx config: cosplan.top -> 301 -> www.cosplan.top, api.cosplan.top -> proxy to 8000
print("3. Writing Nginx config...")
nginx_conf = """# Redirect cosplan.top -> www.cosplan.top (GitHub Pages)
server {
    listen 80;
    server_name cosplan.top;
    return 301 https://www.cosplan.top$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cosplan.top;

    ssl_certificate /etc/nginx/ssl/cosplan.top.crt;
    ssl_certificate_key /etc/nginx/ssl/cosplan.top.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    return 301 https://www.cosplan.top$request_uri;
}

# API backend
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

# Install the multi-domain cert for cosplan.top
print("4. Installing certs...")
run("mkdir -p /etc/nginx/ssl")

# Install cosplan.top cert (from multi-domain issue, the primary domain's files)
run(
    "~/.acme.sh/acme.sh --install-cert -d cosplan.top "
    "--key-file /etc/nginx/ssl/cosplan.top.key "
    "--fullchain-file /etc/nginx/ssl/cosplan.top.crt "
    "--reloadcmd 'systemctl reload nginx' 2>&1"
)

# api.cosplan.top still uses its own cert
run(
    "~/.acme.sh/acme.sh --install-cert -d api.cosplan.top "
    "--key-file /etc/nginx/ssl/api.cosplan.top.key "
    "--fullchain-file /etc/nginx/ssl/api.cosplan.top.crt "
    "--reloadcmd 'systemctl reload nginx' 2>&1"
)

# Write config
stdin, stdout, stderr = client.exec_command("cat > /etc/nginx/sites-available/cosplan-api", timeout=10)
stdin.write(nginx_conf)
stdin.channel.shutdown_write()
stdout.channel.recv_exit_status()

# Test and reload
print("5. Testing Nginx config...")
run("nginx -t")
run("systemctl reload nginx || systemctl restart nginx")

# Verify
print("6. Verifying...")
e, o, _ = run("curl -sk -w ' HTTP:%{http_code}' -o /dev/null https://cosplan.top/")
print(f"  cosplan.top: {o}")

e, o, _ = run("curl -sk -w ' HTTP:%{http_code}' -o /dev/null http://cosplan.top/")
print(f"  http://cosplan.top: {o}")

e, o, _ = run("curl -sk -w ' HTTP:%{http_code}' -o /dev/null https://api.cosplan.top/health")
print(f"  api.cosplan.top: {o}")

client.close()
print("\n[Done]")
