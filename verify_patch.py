#!/usr/bin/env python3
with open(r'C:\Users\Administrator\.openclaw\workspace\cosplan\check_syntax_temp_fixed.js', 'r', encoding='utf-8') as f:
    content = f.read()

checks = [
    ('Background load', 'setTimeout(function' in content),
    ('Auto analyze after upload', "btnAnalyze').click()" in content),
    ('Model check', 'if (!modelsLoaded)' in content),
]
for name, ok in checks:
    print(name + ': ' + ('OK' if ok else 'FAIL'))

print()
print('--- setTimeout background load ---')
idx = content.find('setTimeout(function')
if idx >= 0:
    print(content[idx:idx+200].encode('ascii', errors='replace').decode())

print()
print('--- displayCapturedImage auto-trigger ---')
idx = content.find('function displayCapturedImage')
if idx >= 0:
    end = content.find('function', idx+10)
    if end < 0:
        end = idx + 800
    section = content[idx:end]
    if 'modelsLoaded' in section:
        ml_idx = section.find('modelsLoaded')
        print(section[ml_idx-20:ml_idx+200])
