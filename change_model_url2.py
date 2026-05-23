#!/usr/bin/env python3

with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\check_syntax_temp_fixed.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = "const MODEL_URL = 'https://sunday-bear.github.io/cosplan/models';"
new = "const MODEL_URL = 'https://raw.githubusercontent.com/Sunday-bear/cosplan/main/models';"

if old in content:
    content = content.replace(old, new)
    # Also update face-api.min.js src in the HTML - but we do that via HTML rebuild
    with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\check_syntax_temp_fixed.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print('MODEL_URL updated to GitHub raw')
else:
    print('Not found, checking current value...')
    idx = content.find('MODEL_URL')
    if idx >= 0:
        print('Current:', repr(content[idx:idx+100]))
