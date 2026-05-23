#!/usr/bin/env python3
import httpx, re
r = httpx.get('https://raw.githubusercontent.com/Sunday-bear/cosplan/main/index.html', timeout=15)
text = r.text
scripts = list(re.finditer(r'<script[^>]*>', text))
closes = list(re.finditer(r'</script>', text))
inline_start = scripts[1].end()
inline_end = closes[1].start()
script = text[inline_start:inline_end]
with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\check_syntax_temp.js', 'w', encoding='utf-8') as f:
    f.write(script)
print('Saved, len:', len(script))
