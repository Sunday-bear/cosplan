#!/usr/bin/env python3
with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\index_gh.html', 'r', encoding='utf-8') as f:
    text = f.read()

old = "const apiBase = 'https://cosplan-api.15913625621.workers.dev'"
new = "const apiBase = 'https://api.cosplan.top'"
text = text.replace(old, new)

with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\index_gh.html', 'w', encoding='utf-8') as f:
    f.write(text)

if old in text:
    print('ERROR: old still present')
else:
    print('OK: apiBase replaced')
if new in text:
    print('Verified: ' + new)
