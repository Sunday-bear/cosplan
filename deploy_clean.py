#!/usr/bin/env python3
import httpx, re, paramiko

# Get base HTML
r = httpx.get('https://raw.githubusercontent.com/Sunday-bear/cosplan/main/index.html', timeout=15)
text = r.text

# face-api.min.js back to VPS
text = text.replace(
    'src="https://raw.githubusercontent.com/Sunday-bear/cosplan/main/face-api.min.js"',
    'src="face-api.min.js"'
)

scripts = list(re.finditer(r'<script[^>]*>', text))
closes = list(re.finditer(r'</script>', text))
inline_start = scripts[1].end()
inline_end = closes[1].start()

with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\check_syntax_temp_fixed.js', 'r', encoding='utf-8') as f:
    new_script = f.read()

# MODEL_URL back to local VPS
new_script = new_script.replace(
    "const MODEL_URL = 'https://raw.githubusercontent.com/Sunday-bear/cosplan/main/models';",
    "const MODEL_URL = 'models';"
)

new_html = text[:inline_start] + new_script + text[inline_end:]

# Remove background auto-loading
old_bg = "    setTimeout(function() {\n      loadModels();\n    }, 3000);"
if old_bg in new_html:
    new_html = new_html.replace(old_bg, "    // Models will be loaded on demand")
else:
    # Try other patterns
    print("Background load pattern not found, checking...")
    idx = new_html.find("setTimeout")
    if idx >= 0:
        print("Found at", idx, ":", repr(new_html[idx:idx+80]))

with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\index_patched.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

# Upload
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('45.32.25.221', 22, 'root', '[uU3)f8[,#M,k((f')
s = c.open_sftp(); s.put(r'C:\Users\Administrator\.openclaw\workspace\cosplan\index_patched.html', '/var/www/cosplan/index.html'); s.close()
c.close()
print('Deployed')
