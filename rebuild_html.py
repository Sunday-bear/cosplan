#!/usr/bin/env python3
import httpx, re

r = httpx.get('https://raw.githubusercontent.com/Sunday-bear/cosplan/main/index.html', timeout=15)
text = r.text

# Find script boundaries
scripts = list(re.finditer(r'<script[^>]*>', text))
closes = list(re.finditer(r'</script>', text))
inline_start = scripts[1].end()
inline_end = closes[1].start()

old_script = text[inline_start:inline_end]

# Read the fixed script
with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\check_syntax_temp_fixed.js', 'r', encoding='utf-8') as f:
    fixed_script = f.read()

# Replace the old script with fixed one
new_html = text[:inline_start] + fixed_script + text[inline_end:]

print(f'Old script length: {len(old_script)}')
print(f'Fixed script length: {len(fixed_script)}')
print(f'HTML length: {len(new_html)}')

with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\index_repaired.html', 'w', encoding='utf-8') as f:
    f.write(new_html)
print('Saved')
