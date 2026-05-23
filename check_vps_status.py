#!/usr/bin/env python3
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('45.32.25.221', 22, 'root', '[uU3)f8[,#M,k((f')

# Check API health
stdin, stdout, stderr = c.exec_command('curl -s -o /dev/null -w "%{http_code}" https://api.cosplan.top/')
api_health = stdout.read().decode().strip()
print('API health:', api_health)

# Check main site
stdin, stdout, stderr = c.exec_command('curl -s -o /dev/null -w "%{http_code}" https://cosplan.top/')
site_health = stdout.read().decode().strip()
print('Main site:', site_health)

# Check firewall
stdin, stdout, stderr = c.exec_command('ufw status')
print('Firewall:', stdout.read().decode()[:200])

# Check files deployed
stdin, stdout, stderr = c.exec_command('ls -la /var/www/cosplan/')
print('Files:')
print(stdout.read().decode())

# Check HTML size
stdin, stdout, stderr = c.exec_command('cat /var/www/cosplan/index.html | wc -c')
print('HTML size:', stdout.read().decode().strip())

# Check nginx status
stdin, stdout, stderr = c.exec_command('nginx -t 2>&1 | tail -2')
print('Nginx test:', stdout.read().decode().strip())

# Check SSL expiry
stdin, stdout, stderr = c.exec_command('openssl s_client -connect cosplan.top:443 -servername cosplan.top </dev/null 2>/dev/null | openssl x509 -noout -dates 2>/dev/null')
ssl_info = stdout.read().decode()
if ssl_info:
    print('SSL:', ssl_info.strip())
else:
    # Use alternative
    stdin, stdout, stderr = c.exec_command("date -d \"$(curl -sI https://cosplan.top 2>&1 | grep -i 'date' | cut -d' ' -f2-)\" +'%Y-%m-%d %H:%M:%S'")
    print('Server date:', stdout.read().decode().strip())

c.close()
print('--- Done ---')
