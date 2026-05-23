#!/usr/bin/env python3
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('45.32.25.221', 22, 'root', '[uU3)f8[,#M,k((f')
s = c.open_sftp()
f = s.open('/var/www/cosplan/index.html', 'rb')
data = f.read()
f.close()
c.close()

idx = data.find(b'<script>', data.find(b'<script') + 10)
end = data.find(b'</script>', idx)
script_content = data[idx+8:end].decode('utf-8', errors='replace')
lines = script_content.split('\n')
for i, line in enumerate(lines[:20]):
    print(str(i+1) + ': ' + repr(line[:80]))
print('... total lines:', len(lines))
print('Last line:', repr(lines[-1]))
