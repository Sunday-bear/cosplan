const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3456;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Content-Type': 'application/json'
};

function fetch(urlStr) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const mod = u.protocol === 'https:' ? https : http;
    mod.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  if (parsed.pathname === '/search') {
    const q = parsed.query.q || '';
    const images = [];

    try {
      // Use Bing Image Search (scrape HTML results)
      const html = await fetch(`https://www.bing.com/images/search?q=${encodeURIComponent(q + ' cos')}&count=6&FORM=HDRSC`);
      
      // Extract image URLs from Bing's JSON-in-HTML format
      // Bing embeds image data in script tags and data attributes
      const regex = /"murl":"([^"]+)"/g;
      let match;
      while ((match = regex.exec(html)) !== null) {
        const decoded = match[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
        images.push(decoded);
        if (images.length >= 6) break;
      }
      
      // Fallback: try to find thumbnails
      if (images.length === 0) {
        const thumbRegex = /"turl":"([^"]+)"/g;
        while ((match = thumbRegex.exec(html)) !== null) {
          images.push(match[1]);
          if (images.length >= 6) break;
        }
      }
    } catch (e) {
      console.error('Search error:', e.message);
    }

    console.log(`Search "${q}": ${images.length} images`);
    res.writeHead(200, CORS_HEADERS);
    return res.end(JSON.stringify({ success: true, images, query: q }));
  }

  res.writeHead(200, CORS_HEADERS);
  res.end(JSON.stringify({ status: 'ok', usage: 'GET /search?q=role+name' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\u2705 API server running at http://localhost:${PORT}`);
});
