// Cosplan Image Worker v3
// - /search?q=角色名&type=cos → 花瓣网搜索（高清真人Cos图）
// - /search?q=角色名&type=official → 花瓣网搜索（官方立绘/插画）
// - /proxy?url=图片地址 → 代理输出图片（绕过防盗链）

// ──────────────────────────────────────────────
// 花瓣网搜索 — 高清真人Cos图（小红书级别质量）
// ──────────────────────────────────────────────
async function searchHuaban(query, maxResults = 10) {
  const url = `https://api.huaban.com/search?q=${encodeURIComponent(query)}&page=1&per=${maxResults + 5}&sort=all`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://huaban.com/',
      'Accept': 'application/json'
    }
  });
  if (!resp.ok) return [];
  
  try {
    const data = await resp.json();
    const images = [];
    for (const pin of (data.pins || [])) {
      const file = pin.file || {};
      // 过滤：只取 >=600px 的大图
      if (file.width < 600 || file.height < 600) continue;
      // 过滤：跳过动图
      if (file.type === 'image/gif') continue;
      
      let imgUrl = file.url || '';
      if (imgUrl && imgUrl.startsWith('http')) {
        images.push(imgUrl);
        if (images.length >= maxResults) break;
      }
    }
    return images;
  } catch(e) { return []; }
}

// ──────────────────────────────────────────────
// 降级：搜狗图片搜索（花瓣网返回不够时备用）
// ──────────────────────────────────────────────
async function searchSogou(query) {
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
    for (const item of (data.items || [])) {
      const img = item.pic_url || item.thumb_url || '';
      if (img && img.startsWith('http')) { images.push(img); if (images.length >= 9) break; }
    }
  } catch(e) {
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

// ──────────────────────────────────────────────
// 图片代理
// ──────────────────────────────────────────────
async function proxyImage(imgUrl) {
  // 处理 // 开头的协议相对URL
  if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
  if (!imgUrl.startsWith('http')) return null;
  
  try {
    const resp = await fetch(imgUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://google.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      }
    });
    if (!resp.ok) return null;
    
    const ct = resp.headers.get('Content-Type') || 'image/jpeg';
    // 安全：只代理图片类型
    if (!ct.startsWith('image/')) return null;
    
    const body = await resp.arrayBuffer();
    return new Response(body, {
      headers: {
        'Content-Type': ct,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
        'X-Cosplan-Source': 'proxy'
      }
    });
  } catch(e) {
    return null;
  }
}

// ──────────────────────────────────────────────
// AI 生图 — 调用硅基流动 API
// ──────────────────────────────────────────────
const SF_KEY = 'sk-fbqtxckrosedzhbvwbkpcrrjqojeyurahmbxzrchpqijvitv';
const SF_ENDPOINT = 'https://api.siliconflow.cn/v1/images/generations';

async function generateAI(charName, charTraits) {
  // Build a precise prompt based on character
  const prompt = makeCharPrompt(charName, charTraits);
  
  const body = JSON.stringify({
    model: 'Tongyi-MAI/Z-Image-Turbo',
    prompt: prompt,
    n: 1
  });
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  const resp = await fetch(SF_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + SF_KEY,
      'Content-Type': 'application/json'
    },
    body: body,
    signal: controller.signal
  });
  clearTimeout(timeoutId);
  
  if (!resp.ok) {
    const err = await resp.text();
    return { success: false, error: 'API error: ' + err };
  }
  
  const data = await resp.json();
  const images = data.images || [];
  if (images.length === 0) return { success: false, error: 'no image generated' };
  
  return {
    success: true,
    imageUrl: images[0].url,
    timing: data.timings,
    seed: data.seed
  };
}

function makeCharPrompt(charName, traits) {
  // Default props for each character — extend as needed
  const charDB = {
    '蕾姆': 'short blue hair with left swept bangs, white maid headband, blue eyes, pale skin, blue-white maid dress',
    '血小板': 'short light blue hair, red eyes, cute child face, white lab coat, medical cap',
    '甘露寺蜜璃': 'long pink hair with streaks, pink-green eyes, beauty mark under eye, smiling',
    '时崎狂三': 'long black and red hair, red-gold eyes, clock eye, gothic dress, dual-tone hair',
    '02': 'long pink hair, red horns, blue eyes, pink and white outfit, confident smirk',
    '薇尔莉特': 'long blonde hair, blue eyes, Victorian dress, white gloves, brooch',
    '托尔': 'long blonde hair with strands, green eyes, dragon tail, maid outfit, cheerful smile',
    '康娜': 'short white hair, purple eyes, chubby face, light blue dress, cute small dragon',
    '蝴蝶忍': 'short dark purple hair, purple eyes, calm smile, butterfly hairpin, haori coat',
    '灶门祢豆子': 'long black hair with pink ends, pink eyes, bamboo muzzle, pink kimono, small',
    '胡桃': 'brown hair in twin braids, yellow eyes, witch hat, black-red outfit, energetic',
    '刻晴': 'long purple hair in bun with ponytail, purple eyes, elegant Chinese dress, sword',
    '甘雨': 'long blue hair with red streak, blue eyes, gentle smile, half-rim glasses, qipao',
    '纳西妲': 'short white hair with green leaves, green eyes, tiny, white dress with green',
    '雷电将军': 'long purple hair in braid, purple eyes, stoic expression, kimono with armor',
    '温迪': 'short black-blue hair with braids, green eyes, cheerful, green bard outfit, lyre',
    '芙宁娜': 'long white-blue hair with hat, blue heterochromia, white-blue elegant outfit',
    '亚丝娜': 'long chestnut hair, hazel eyes, red-white knight outfit, cute determined face',
    '御坂美琴': 'short brown hair, hazel eyes, tsundere expression, school uniform with tie',
    '雪之下雪乃': 'long black hair, blue eyes, cold beauty, school uniform, serious expression',
    '由比滨结衣': 'short pink hair with hairband, red eyes, cheerful, school uniform, pink accents',
    '宝多六花': 'long black-blue hair, blue eyes, lazy expression, school uniform with jacket',
    '新条茜': 'long purple hair with red streak, yellow eyes, glasses, school uniform, smug',
    '妮可罗宾': 'long black hair, blue eyes, tall, intellectual smile, hat, coat',
    '娜美': 'long orange hair, brown eyes, confident smile, tattoo on shoulder, crop top',
  };
  
  const props = charDB[charName];
  if (props) {
    return 'anime character portrait of ' + charName + ' from anime, ' + props + ', official character art style, clean high quality illustration, front view, bright lighting';
  }
  return 'anime girl character portrait, high quality anime art style, cute expression, clean illustration, front view';
}

// ──────────────────────────────────────────────
// 工具
// ──────────────────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    }
  });
}

// ──────────────────────────────────────────────
// 路由
// ──────────────────────────────────────────────
export default {
  async fetch(request) {
    const url = new URL(request.url);
    
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
    
    // ===== /search 搜索 =====
    if (url.pathname === '/search') {
      const q = url.searchParams.get('q') || '';
      const type = url.searchParams.get('type') || 'cos';
      
      if (!q) return json({ success: false, error: '缺少参数 q' }, 400);
      
      // 根据 type 构建搜索关键词
      let huabanQuery, sogouQuery;
      if (type === 'cos') {
        // 搜真人Cos图
        huabanQuery = `${q} cos コスプレ`;
        sogouQuery = `${q} cos コスプレ 真人`;
      } else {
        // 搜官方立绘/插画
        huabanQuery = `${q} イラスト キャラクター`;
        sogouQuery = `${q} イラスト キャラクター 公式`;
      }
      
      let images = [];
      let source = '';
      
      // 优先花瓣网
      try {
        images = await searchHuaban(huabanQuery, 10);
        source = 'huaban';
      } catch(e) {}
      
      // 花瓣不够→搜狗补充
      if (images.length < 3) {
        try {
          const sogouImages = await searchSogou(sogouQuery);
          for (const img of sogouImages) {
            if (!images.includes(img)) { images.push(img); if (images.length >= 10) break; }
          }
          source = images.length > 0 ? (source || 'sogou') : '';
        } catch(e) {}
      }
      
      return json({
        success: images.length > 0,
        images,
        query: q,
        type,
        source,
        count: images.length
      });
    }
    
    // ===== /aigen AI 生图 =====
    if (url.pathname === '/aigen') {
      const charName = url.searchParams.get('name') || '';
      if (!charName) return json({ success: false, error: '缺少 name 参数' }, 400);
      
      const result = await generateAI(charName, {});
      return json(result, result.success ? 200 : 500);
    }
    
    // ===== /proxy 图片代理 =====
    if (url.pathname === '/proxy') {
      const imgUrl = url.searchParams.get('url');
      if (!imgUrl) return json({ success: false, error: '缺少 url 参数' }, 400);
      
      const result = await proxyImage(imgUrl);
      if (result) return result;
      
      return json({ success: false, error: '图片加载失败' }, 502);
    }
    
    // ===== 根路径 / =====
    if (url.pathname === '/' || url.pathname === '') {
      return json({ 
        status: 'Cosplan Image Worker v4',
        endpoints: {
          search: '/search?q=角色名&type=cos|official',
          proxy: '/proxy?url=图片地址',
          aigen: '/aigen?name=角色名'
        }
      });
    }
    
    return json({ success: false, error: 'Not found' }, 404);
  }
};
