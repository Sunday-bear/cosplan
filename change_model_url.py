#!/usr/bin/env python3

with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\check_syntax_temp_fixed.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = "const MODEL_URL = 'models';"
new = "const MODEL_URL = 'https://sunday-bear.github.io/cosplan/models';"

if old in content:
    content = content.replace(old, new)
    with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\check_syntax_temp_fixed.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print('MODEL_URL updated to GitHub Pages CDN')
else:
    print('Not found!')
    idx = content.find('MODEL_URL')
    if idx >= 0:
        print('Found:', repr(content[idx:idx+60]))
