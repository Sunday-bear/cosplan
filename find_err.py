#!/usr/bin/env python3
with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\index_gh.html', 'rb') as f:
    data = f.read()
text = data.decode('utf-8', errors='replace')
idx = text.find('<script>', text.find('</script>') + 10)
content = idx > 0 and text[idx+8:] or ''
lines = content.split('\n')
print('Total lines:', len(lines))
for i in range(325, min(336, len(lines))):
    line = lines[i].replace('\r', '').strip()
    if len(line) > 80:
        line = line[:80] + '...'
    print(str(i+1) + ': ' + line)
