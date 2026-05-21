// Cosplan Image Worker v2
// - /search?q=角色名+cos → 搜搜狗图片，返回图片列表
// - /proxy?url=图片地址 → 代理输出图片（绕过防盗链）
// - /proxy/完整url → 路径式代理

const SEARCH_SOURCES = [
  'sogou',
  'baidu',
  'weibo'
];

async function searchSogou(query) {
  // 搜狗图片搜索
  const url = `https://pic.sogou.com/pics?query=${encodeURIComponent(query)}&mode=1&start=0&reqType=ajax`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://pic.sogou.com/'
    }
  });
  if (!resp.ok) return [];
  
  const text = await resp.text();
  const images = [];
  
  try {
    const data = JSON.parse(text);
    const items = data.items || [];
    for (const item of items) {
      // 搜狗返回的图片地址有 pic_url / thumb_url 等字段
      const img = item.pic_url || item.thumb_url || item.source_pic_url || '';
      if (img && img.startsWith('http')) {
        images.push(img);
        if (images.length >= 9) break;
      }
    }
  } catch (e) {
    // 搜狗有时返回的不是标准JSON，尝试正则提取
    const matches = text.match(/"pic_url":"([^"]+)"/g);
    if (matches) {
      for (const m of matches.slice(0, 9)) {
        const img = m.replace(/"pic_url":"/, '').replace(/"$/, '').replace(/\\/g, '');
        if (img.startsWith('http')) images.push(img);
      }
    }
  }
  return images;
}

async function searchBaidu(query) {
  // 百度图片搜索
  const url = `https://image.baidu.com/search/acjson?tn=resultjson_com&logid=&ipn=rj&word=${encodeURIComponent(query)}&pn=0&rn=12`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://image.baidu.com/'
    }
  });
  if (!resp.ok) return [];
  
  try {
    const data = await resp.json();
    const images = [];
    for (const item of (data.data || [])) {
      // 百度返回 thumbURL 或 middleURL
      const img = item.thumbURL || item.middleURL || '';
      if (img && img.startsWith('http')) {
        images.push(img);
        if (images.length >= 9) break;
      }
    }
    return images;
  } catch (e) {
    return [];
  }
}

async function searchWeibo(query) {
  // 微博搜索（部分关键词可能返回432错误）
  const url = `https://m.weibo.cn/api/container/getIndex?containerid=100103type%3D1%26q%3D${encodeURIComponent(query)}&page=1`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      'Referer': 'https://m.weibo.cn/'
    }
  });
  if (!resp.ok) return [];
  
  try {
    const data = await resp.json();
    const images = [];
    for (const card of (data.data?.cards || [])) {
      const pics = card.mblog?.pics || card.mblog?.retweeted_status?.pics || [];
      for (const p of pics) {
        const u = p.large?.url || p.url;
        if (u) images.push('https:' + u);
        if (images.length >= 9) break;
      }
      if (images.length >= 9) break;
    }
    return images;
  } catch (e) {
    return [];
  }
}

async function proxyImage(imageUrl) {
  // 代理图片，解决防盗链
  try {
    // 处理相对协议URL
    let targetUrl = imageUrl;
    if (targetUrl.startsWith('//')) targetUrl = 'https:' + targetUrl;
    if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;
    
    // 解码URL编码
    targetUrl = decodeURIComponent(targetUrl);
    
    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.google.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      }
    });
    
    if (!resp.ok) return null;
    
    const contentType = resp.headers.get('Content-Type') || 'image/jpeg';
    const body = await resp.arrayBuffer();
    
    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
        'X-Cosplan-Proxy': 'true'
      }
    });
  } catch (e) {
    return null;
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };
    
    const json = (data, status = 200) => new Response(JSON.stringify(data), { 
      status, headers: corsHeaders 
    });
    
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        }
      });
    }
    
    // ===== /search - 搜索Cos图片 =====
    if (url.pathname === '/search') {
      const q = url.searchParams.get('q') || '';
      if (!q) return json({ success: false, error: '缺少搜索关键词 q' }, 400);
      
      const query = q + ' cos';
      const source = url.searchParams.get('source') || 'all';
      let images = [];
      let sourceUsed = '';
      
      // 按源搜索
      if (source === 'sogou' || source === 'all') {
        try {
          const sogouImages = await searchSogou(query);
          if (sogouImages.length > 0) {
            images = sogouImages;
            sourceUsed = 'sogou';
          }
        } catch (e) {}
      }
      
      if (images.length === 0 && (source === 'baidu' || source === 'all')) {
        try {
          const baiduImages = await searchBaidu(query);
          if (baiduImages.length > 0) {
            images = baiduImages;
            sourceUsed = 'baidu';
          }
        } catch (e) {}
      }
      
      if (images.length === 0 && (source === 'weibo' || source === 'all')) {
        try {
          const weiboImages = await searchWeibo(query);
          if (weiboImages.length > 0) {
            images = weiboImages;
            sourceUsed = 'weibo';
          }
        } catch (e) {}
      }
      
      return json({
        success: images.length > 0,
        images,
        query: q,
        source: sourceUsed,
        count: images.length
      });
    }
    
    // ===== /proxy - 图片代理（解决防盗链）=====
    if (url.pathname === '/proxy') {
      const imgUrl = url.searchParams.get('url');
      if (!imgUrl) return json({ success: false, error: '缺少图片url参数' }, 400);
      
      const result = await proxyImage(imgUrl);
      if (result) return result;
      
      return json({ success: false, error: '图片加载失败' }, 502);
    }
    
    // ===== /proxy/* - 路径式代理 =====
    if (url.pathname.startsWith('/proxy/')) {
      const imgUrl = url.pathname.slice(7); // 去掉 "/proxy/"
      if (!imgUrl) return json({ success: false }, 400);
      
      const result = await proxyImage(imgUrl);
      if (result) return result;
      
      return json({ success: false, error: '图片加载失败' }, 502);
    }
    
    // ===== 根路径 / =====
    if (url.pathname === '/' || url.pathname === '') {
      return json({ 
        status: 'Cosplan Image Worker v2',
        usage: {
          search: 'GET /search?q=角色名[&source=sogou|baidu|weibo|all]',
          proxy: 'GET /proxy?url=图片地址',
          proxy_path: 'GET /proxy/原始图片URL'
        }
      });
    }
    
    return json({ error: 'Not Found' }, 404);
  }
};
