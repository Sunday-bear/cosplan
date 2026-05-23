// Vercel serverless function: cosplay image search
// Searches Bilibili cosplay + falls back to other sources
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { name, series } = req.query;
  if (!name) return res.status(400).json({ error: 'Missing character name' });

  const keyword = series ? `${series} ${name} cos` : `${name} cosplay`;

  try {
    const images = await searchBilibili(keyword, name);
    res.json({ success: true, images, keyword });
  } catch (e) {
    console.error(e);
    // Fallback: return search links
    res.json({
      success: true,
      images: [],
      fallback: true,
      searchUrls: {
        bilibili: `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}&order=click`,
        weibo: `https://s.weibo.com/weibo?q=${encodeURIComponent(keyword + ' cosplay')}`,
        baidu: `https://image.baidu.com/search?tn=baiduimage&word=${encodeURIComponent(keyword + ' cosplay 真人')}`,
      }
    });
  }
}

async function searchBilibili(keyword, charName) {
  // Try Bilibili photo search API
  const url = `https://api.bilibili.com/x/web-interface/search/type?search_type=photo&keyword=${encodeURIComponent(keyword)}&page=1`;
  
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.bilibili.com/',
      'Accept': 'application/json',
    }
  });
  
  if (!resp.ok) throw new Error(`Bilibili API returned ${resp.status}`);
  
  const data = await resp.json();
  const results = data?.data?.result || [];
  
  // Extract image URLs, filter for likely cosplay content
  const images = [];
  for (const item of results) {
    if (item.cover || item.pic) {
      const imgUrl = (item.cover || item.pic).replace('http://', 'https://');
      if (imgUrl.includes('hdslb.com')) {
        images.push(imgUrl);
        if (images.length >= 6) break;
      }
    }
  }
  
  // If no results, try text search for video covers
  if (images.length === 0) {
    const videoUrl = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(keyword + ' cosplay')}&page=1`;
    const vResp = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com/',
        'Accept': 'application/json',
      }
    });
    if (vResp.ok) {
      const vData = await vResp.json();
      const vResults = vData?.data?.result || [];
      for (const item of vResults) {
        if (item.pic) {
          images.push(item.pic.replace('http://', 'https://'));
          if (images.length >= 6) break;
        }
      }
    }
  }

  return images;
}
