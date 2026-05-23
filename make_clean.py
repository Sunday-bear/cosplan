#!/usr/bin/env python3
import httpx

# Get the GitHub version
r = httpx.get('https://raw.githubusercontent.com/Sunday-bear/cosplan/main/index.html', timeout=15)
text = r.text

# Just replace the api base URL - keep EVERYTHING else identical
old = "const apiBase = 'https://cosplan-api.15913625621.workers.dev'"
new = "const apiBase = 'https://api.cosplan.top'"
print('Old present:', old in text)
text = text.replace(old, new)
print('New present:', new in text)
print('File size:', len(text))

# Also replace the title
text = text.replace('<title>版本2已上线 · 粉色边框</title>', '<title>Cosplan · 角色快诊</title>')

# Save
with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\index_clean.html', 'w', encoding='utf-8') as f:
    f.write(text)
print('Saved')

# Verify braces in script
idx = text.find('<script>')
idx2 = text.find('<script>', idx + 10)
content = text[idx2+8:]
opens = content.count('{')
closes = content.count('}')
print('{}: open=' + str(opens) + ' close=' + str(closes) + ' diff=' + str(opens-closes))
