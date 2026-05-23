#!/usr/bin/env python3
import httpx

# Get the raw GitHub version
r = httpx.get('https://raw.githubusercontent.com/Sunday-bear/cosplan/main/index.html', timeout=15)
text = r.text

# Replace apiBase
old = "const apiBase = 'https://cosplan-api.15913625621.workers.dev'"
new = "const apiBase = 'https://api.cosplan.top'"
text = text.replace(old, new)

# Also replace title
text = text.replace('<title>版本2已上线 · 粉色边框</title>', '<title>Cosplan · 角色快诊</title>')

# Wrap entire script in an async IIFE
script_start = text.find('<script>')
script_start2 = text.find('<script>', script_start + 10)
script_content_start = script_start2 + 8

script_end = text.find('</script>', script_content_start)

old_script = text[script_content_start:script_end]
# Wrap in async IIFE
new_script = '(async function(){' + old_script + '\n})();'
text = text[:script_content_start] + new_script + text[script_end:]

print('Size:', len(text))

with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\index_wrapped.html', 'w', encoding='utf-8') as f:
    f.write(text)
print('Saved')
