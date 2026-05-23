#!/usr/bin/env python3
import httpx

r = httpx.get('https://raw.githubusercontent.com/Sunday-bear/cosplan/main/index.html', timeout=15)
text = r.text

# Find the second (inline) script tag properly
import re
scripts = list(re.finditer(r'<script[^>]*>', text))
closes = list(re.finditer(r'</script>', text))

# Script 1 = inline script
inline_start = scripts[1].end()  # after '>'
inline_end = closes[1].start()   # before '</script>'

old_script = text[inline_start:inline_end]
print(f'Script content: {len(old_script)} chars')
print(f'First 50: {repr(old_script[:50])}')

# Replace apiBase
old = "const apiBase = 'https://cosplan-api.15913625621.workers.dev'"
new = "const apiBase = 'https://api.cosplan.top'"
if old in old_script:
    new_script = old_script.replace(old, new)
else:
    print('WARNING: old apiBase not found')
    new_script = old_script

# Verify brace balance
opens = new_script.count('{')
closes_b = new_script.count('}')
print(f'Brace balance: open={opens} close={closes_b} diff={opens - closes_b}')

# Wrap in async IIFE
wrapped_script = '(async function(){' + new_script + '\n})();'

text = text[:inline_start] + wrapped_script + text[inline_end:]

print(f'Final size: {len(text)}')

with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\index_wrapped2.html', 'w', encoding='utf-8') as f:
    f.write(text)
print('Saved')
