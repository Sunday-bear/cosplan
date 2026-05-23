#!/usr/bin/env python3
import httpx, json

# Test Pixiv search via API
r = httpx.post('https://api.cosplan.top/search', 
    json={'character': 'Emilia', 'count': 3}, 
    verify=False, timeout=20)
data = r.json()
print('Success:', data.get('success'))
print('Character:', data.get('character'))
print('Images count:', len(data.get('images', [])))
if data.get('images'):
    print('First image:', json.dumps(data['images'][0], ensure_ascii=False))
if data.get('error'):
    print('Error:', data['error'])
