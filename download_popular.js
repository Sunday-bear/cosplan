const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');

const searchList = [
  ['卡提希娅', '鸣潮 cosplay'],
  ['流萤', '崩坏星穹铁道 cosplay'],
  ['昔涟', '崩坏星穹铁道 cosplay'],
  ['胡桃', '原神 cosplay'],
  ['折枝', '鸣潮 cosplay'],
  ['守岸人', '鸣潮 cosplay'],
  ['长离', '鸣潮 cosplay'],
  ['霍霍', '崩坏星穹铁道 cosplay'],
  ['艾莲', '绝区零 cosplay'],
  ['妮露', '原神 cosplay']
];

const imgDir = path.join(__dirname, 'images', 'popular');
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

let completed = 0;

for (const [shortName, querySuffix] of searchList) {
  const query = shortName + ' ' + querySuffix;
  const encodedQuery = encodeURIComponent(query);
  const url = `https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&word=${encodedQuery}&pn=0&rn=5`;

  https.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json, text/plain, */*',
    }
  }, (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => {
      try {
        // Parse Baidu image search JSON
        const json = JSON.parse(data);
        const imgs = json.data || [];
        console.log(`${shortName}: found ${imgs.length} results from Baidu`);

        // Also try extracting thumbURL directly
        const thumbMatches = data.match(/"thumbURL":"([^"]+)"/g) || [];
        const thumbUrls = thumbMatches.map(m => {
          return m.replace(/^"thumbURL":"/, '').replace(/"$/, '');
        });

        console.log(`  extracted ${thumbUrls.length} thumb URLs`);

        let dlCount = 0;
        const toDownload = thumbUrls.slice(0, 2);

        if (toDownload.length === 0) {
          console.log(`  no images for ${shortName}, skipping`);
          completed++;
          return;
        }

        for (const imgUrl of toDownload) {
          const safeExt = path.extname(imgUrl.split('?')[0].split('#')[0]) || '.jpg';
          const fname = `${shortName}_${dlCount + 1}${safeExt}`;
          const fpath = path.join(imgDir, fname);

          const client = imgUrl.startsWith('https') ? https : http;

          const req = client.get(imgUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://image.baidu.com/',
            },
            timeout: 10000
          }, (imgRes) => {
            if (imgRes.statusCode !== 200) {
              console.log(`  ${shortName}: HTTP ${imgRes.statusCode} for ${imgUrl.slice(0,60)}`);
              dlCount++;
              checkDone();
              return;
            }
            const chunks = [];
            imgRes.on('data', (c) => chunks.push(c));
            imgRes.on('end', () => {
              const buf = Buffer.concat(chunks);
              fs.writeFileSync(fpath, buf);
              console.log(`  saved: ${fname} (${(buf.length / 1024).toFixed(0)}KB)`);
              dlCount++;
              checkDone();
            });
          });
          req.on('error', (e) => {
            console.log(`  download error for ${shortName}: ${e.message}`);
            dlCount++;
            checkDone();
          });
          req.end();
        }
      } catch (e) {
        console.log(`${shortName}: parse error - ${e.message}`);
        completed++;
      }
    });
  }).on('error', (e) => {
    console.log(`${shortName}: request error - ${e.message}`);
    completed++;
  });
}

function checkDone() {
  // Each character should have 2 downloads attempted, so total expected = searchList.length * 2
  // Simple approach: just log progress
}
