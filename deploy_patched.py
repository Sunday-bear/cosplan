#!/usr/bin/env python3
import httpx, re, paramiko

r = httpx.get('https://raw.githubusercontent.com/Sunday-bear/cosplan/main/index.html', timeout=15)
text = r.text

# Change face-api.min.js src to GitHub raw
text = text.replace('src="face-api.min.js"', 'src="https://raw.githubusercontent.com/Sunday-bear/cosplan/main/face-api.min.js"')

scripts = list(re.finditer(r'<script[^>]*>', text))
closes = list(re.finditer(r'</script>', text))
inline_start = scripts[1].end()
inline_end = closes[1].start()

with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\check_syntax_temp_fixed.js', 'r', encoding='utf-8') as f:
    new_script = f.read()

new_html = text[:inline_start] + new_script + text[inline_end:]

with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\index_patched.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

# Upload
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('45.32.25.221', 22, 'root', '[uU3)f8[,#M,k((f')
s = c.open_sftp(); s.put(r'C:\Users\Administrator\.openclaw\workspace\cosplan\index_patched.html', '/var/www/cosplan/index.html'); s.close()

# Verify
stdin, stdout, stderr = c.exec_command('grep -c "raw.githubusercontent" /var/www/cosplan/index.html')
print('GitHub raw refs:', stdout.read().decode().strip())
c.close()
print('Deployed')
