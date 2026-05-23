#!/usr/bin/env python3
with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\index_gh.html', 'rb') as f:
    data = f.read()
idx = data.find(b'<script>', data.find(b'<script') + 10)
end = data.find(b'</script>', idx)
script = data[idx+8:end]
opens = script.count(b'{')
closes = script.count(b'}')
print('{}: open=' + str(opens) + ' close=' + str(closes) + ' diff=' + str(opens-closes))
paren_open = script.count(b'(')
paren_close = script.count(b')')
print('(): open=' + str(paren_open) + ' close=' + str(paren_close) + ' diff=' + str(paren_open - paren_close))
lines = script.decode('utf-8', errors='replace').split('\n')
depth = 0
for i, line in enumerate(lines):
    for ch in line:
        if ch == '{': depth += 1
        if ch == '}': depth -= 1
    if depth < 0:
        print('NEGATIVE at line ' + str(i+1))
        depth = 0
print('Final depth:', depth)
