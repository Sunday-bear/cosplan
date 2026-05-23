const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const characters = [
  { name: '卡提希娅', apiName: '卡提希娅' },
  { name: '流萤', apiName: '流萤 Firefly' },
  { name: '昔涟', apiName: '昔涟' },
  { name: '胡桃', apiName: '胡桃 原神' },
  { name: '折枝', apiName: '折枝 鸣潮' },
  { name: '守岸人', apiName: '守岸人 鸣潮' },
  { name: '长离', apiName: '长离 鸣潮' },
  { name: '霍霍', apiName: '霍霍 崩坏' },
  { name: '艾莲', apiName: '艾莲 绝区零' },
  { name: '妮露', apiName: '妮露 原神' },
];

const imgDir = path.join(__dirname, 'images', 'popular');
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

const results = {};
let index = 0;

function next() {
  if (index >= characters.length) {
    console.log('\n=== ALL DONE ===');
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  
  const char = characters[index];
  const apiName = char.apiName;
  const data = JSON.stringify({ character: apiName });
  
  console.log(`[${index + 1}/${characters.length}] Searching: ${char.name} (API: ${apiName})`);
  
  const opts = {
    hostname: 'api.cosplan.top',
    path: '/search',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };
  
  const req = https.request(opts, (res) => {
    let body = '';
    res.on('data', (c) => body += c);
    res.on('end', () => {
      try {
        const j = JSON.parse(body);
        const images = j.images || [];
        results[char.name] = { count: images.length, saved: 0 };
        
        if (images.length > 0) {
          downloadImages(char.name, images.slice(0, 2), () => {
            results[char.name].saved = Math.min(images.length, 2);
            index++;
            setTimeout(next, 200);
          });
        } else {
          console.log(`  No images found for ${char.name}`);
          index++;
          setTimeout(next, 200);
        }
      } catch (e) {
        console.log(`  Parse error for ${char.name}: ${e.message}`);
        results[char.name] = { count: 0, saved: 0, error: e.message };
        index++;
        setTimeout(next, 200);
      }
    });
  });
  
  req.on('error', (e) => {
    console.log(`  Request error for ${char.name}: ${e.message}`);
    results[char.name] = { count: 0, saved: 0, error: e.message };
    index++;
    setTimeout(next, 200);
  });
  
  req.write(data);
  req.end();
}

function downloadImages(charName, images, callback) {
  let done = 0;
  const total = images.length;
  
  for (let i = 0; i < total; i++) {
    const url = 'https://api.cosplan.top' + images[i].url;
    const ext = '.jpg';
    const fname = `${charName}_${i + 1}${ext}`;
    const fpath = path.join(imgDir, fname);
    
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) {
        console.log(`  ${charName} img ${i+1}: HTTP ${res.statusCode}`);
        done++;
        if (done >= total) callback();
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        fs.writeFileSync(fpath, buf);
        console.log(`  Saved: ${fname} (${(buf.length / 1024).toFixed(0)}KB)`);
        done++;
        if (done >= total) callback();
      });
    }).on('error', (e) => {
      console.log(`  Download error ${charName} img ${i+1}: ${e.message}`);
      done++;
      if (done >= total) callback();
    });
  }
}

next();
