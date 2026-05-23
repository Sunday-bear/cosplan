// Vercel Serverless Function: cosplay image search proxy
// Searches weibo + bilibili for real cosplay photos via server-side fetch
// Deploy: just push to GitHub, connect to Vercel

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'missing q' });

  const images = [];

  // Strategy 1: Search weibo (most reliable for real cosplay)
  try {
    const wbUrl = `https://m.weibo.cn/api/container/getIndex?containerid=100103type%3D1%26q%3D${encodeURIComponent(q + ' cos')}&page=1`;
    const wbResp = await fetch(wbUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://m.weibo.cn/' }
    });
    if (wbResp.ok) {
      const wbData = await wbResp.json();
      const cards = wbData?.data?.cards || [];
      for (const card of cards) {
        const pics = card?.mblog?.pics || card?.mblog?.retweeted_status?.pics || [];
        for (const pic of pics) {
          if (pic.large?.url) images.push(pic.large.url);
          else if (pic.url) images.push(pic.url);
          if (images.length >= 6) break;
        }
        if (images.length >= 6) break;
      }
    }
  } catch(e) {}

  // Strategy 2: Try bilibili search (may hit rate limit)
  if (images.length < 3) {
    try {
      const blUrl = `https://api.bilibili.com/x/web-interface/search/type?search_type=photo&keyword=${encodeURIComponent(q)}&page=1`;
      const blResp = await fetch(blUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bilibili.com/', 'Origin': 'https://www.bilibili.com' }
      });
      if (blResp.ok) {
        const blData = await blResp.json();
        const results = blData?.data?.result || [];
        for (const item of results) {
          const pic = item.cover || item.pic;
          if (pic) {
            images.push(pic.replace('http://', 'https://'));
            if (images.length >= 6) break;
          }
        }
      }
    } catch(e) {}
  }

  return res.json({ success: true, images, query: q });
}
