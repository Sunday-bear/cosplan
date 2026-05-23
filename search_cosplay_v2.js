// Improved Baidu image cosplay scraper - extracts sinaimg.cn and hdslb.com URLs
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const characters = [
  { name: '蕾姆', series: 'Re从零开始的异世界生活', img: '88575', safe: 'rem' },
  { name: '血小板', series: '工作细胞', img: '127417', safe: 'platelet' },
  { name: '甘露寺蜜璃', series: '鬼灭之刃', img: '136072', safe: 'kanroji_mitsuri' },
  { name: '时崎狂三', series: '约会大作战', img: '70069', safe: 'kurumi' },
  { name: '02', series: 'DARLING in the FRANXX', img: '124381', safe: 'zero_two' },
  { name: '薇尔莉特', series: '紫罗兰永恒花园', img: '90169', safe: 'violet' },
  { name: '蝴蝶忍', series: '鬼灭之刃', img: '150672', safe: 'shinobu' },
  { name: '亚丝娜', series: '刀剑神域', img: '3634', safe: 'asuna' },
  { name: 'Saber', series: 'Fate', img: '2746', safe: 'saber' },
  { name: '艾米莉亚', series: 'Re从零开始的异世界生活', img: '88572', safe: 'emilia' },
  { name: '五更琉璃', series: '我的妹妹不可能那么可爱', img: '31008', safe: 'kuroneko' },
  { name: '三笠阿克曼', series: '进击的巨人', img: '40881', safe: 'mikasa' },
  { name: '八重神子', series: '原神', img: '227380', safe: 'yae_miko' },
  { name: '雷电将军', series: '原神', img: '211643', safe: 'raiden' },
  { name: '康娜', series: '小林家的龙女仆', img: '86589', safe: 'kanna' },
  { name: '托尔', series: '小林家的龙女仆', img: '120970', safe: 'tohru' },
  { name: '五条悟', series: '咒术回战', img: '127691', safe: 'gojo' },
  { name: '炭治郎', series: '鬼灭之刃', img: '126071', safe: 'tanjiro' },
  { name: '利威尔', series: '进击的巨人', img: '45627', safe: 'levi' },
  { name: '太宰治', series: '文豪野犬', img: '89198', safe: 'dazai' },
  { name: '宇智波佐助', series: '火影忍者', img: '13', safe: 'sasuke' },
  { name: '漩涡鸣人', series: '火影忍者', img: '17', safe: 'naruto' },
  { name: '杀生丸', series: '犬夜叉', img: '1358', safe: 'sesshomaru' },
  { name: '中原中也', series: '文豪野犬', img: '89853', safe: 'chuuya' },
  { name: '钟离', series: '原神', img: '208225', safe: 'zhongli' },
  { name: '灶门祢豆子', series: '鬼灭之刃', img: '127518', safe: 'nezuko' },
  { name: '胡桃', series: '原神', img: '215788', safe: 'hutao' },
  { name: '刻晴', series: '原神', img: '215796', safe: 'keqing' },
  { name: '魈', series: '原神', img: '215780', safe: 'xiao' },
  { name: '木之本樱', series: '魔卡少女樱', img: '2671', safe: 'sakura' },
  { name: '阿尼亚', series: '间谍过家家', img: '138100', safe: 'anya' },
  { name: '约尔', series: '间谍过家家', img: '138102', safe: 'yor' },
  { name: '黄昏', series: '间谍过家家', img: '138101', safe: 'loid' },
  { name: '楪祈', series: '罪恶王冠', img: '43280', safe: 'inori' },
  { name: '艾伦耶格尔', series: '进击的巨人', img: '40882', safe: 'eren' },
  { name: '金木研', series: '东京喰种', img: '87275', safe: 'kaneki' },
  { name: '达达利亚', series: '原神', img: '209687', safe: 'tartaglia' },
  { name: '甘雨', series: '原神', img: '233410', safe: 'ganyu' },
];

function upgradeSinaUrl(url) {
  // Upgrade sinaimg thumbnails to larger versions
  return url
    .replace(/\/mw690\//, '/large/')
    .replace(/\/mw1024\//, '/large/')
    .replace(/\/orj360\//, '/large/')
    .replace(/\/square\//, '/large/')
    .replace(/\/thumb150\//, '/large/')
    .replace(/\/thumbnail\//, '/large/');
}

function upgradeHdslbUrl(url) {
  // Remove trailing size params from hdslb URLs to get original
  return url.replace(/@\d+w_\d+h.*$/, '');
}

function isTargetDomain(url) {
  const lower = url.toLowerCase();
  return lower.includes('sinaimg.cn') || lower.includes('hdslb.com');
}

async function searchCharacter(browser, char) {
  const query = `${char.name} ${char.series} coser cos正片`;
  const encodedQuery = encodeURIComponent(query);
  const url = `https://image.baidu.com/search/index?tn=baiduimage&word=${encodedQuery}`;

  console.log(`\n[${char.name}] Searching...`);

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let imageUrls = [];

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for results to appear
    await new Promise(r => setTimeout(r, 2000));

    // Scroll to load more images
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
      await new Promise(r => setTimeout(r, 800));
    }

    // Extract all image sources
    const allSrcs = await page.evaluate(() => {
      const urls = new Set();
      
      // Method 1: Extract from objurl params in links
      document.querySelectorAll('a[href*="objurl="]').forEach(a => {
        const href = a.getAttribute('href') || '';
        const match = href.match(/objurl=([^&]+)/);
        if (match) {
          try {
            urls.add(decodeURIComponent(match[1]));
          } catch(e) {}
        }
      });

      // Method 2: Direct img elements
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.getAttribute('data-src') || '';
        if (src && src.startsWith('http') && !src.includes('bdimg') && !src.includes('bdstatic') && !src.includes('baidu.com')) {
          urls.add(src);
        }
      });

      // Method 3: CSS background images
      document.querySelectorAll('[style*="url("]').forEach(el => {
        const style = el.getAttribute('style') || '';
        const match = style.match(/url\(["']?([^"')]+)["']?\)/g);
        if (match) {
          match.forEach(m => {
            const urlMatch = m.match(/url\(["']?([^"')]+)["']?\)/);
            if (urlMatch && urlMatch[1].startsWith('http')) {
              urls.add(urlMatch[1]);
            }
          });
        }
      });

      return [...urls];
    });

    // Filter and upgrade
    const filtered = allSrcs
      .filter(url => isTargetDomain(url))
      .map(url => {
        let upgraded = url;
        if (url.includes('sinaimg.cn')) upgraded = upgradeSinaUrl(url);
        if (url.includes('hdslb.com')) upgraded = upgradeHdslbUrl(url);
        return upgraded;
      })
      .filter((url, idx, arr) => arr.indexOf(url) === idx); // dedupe

    imageUrls = filtered;
    console.log(`  Found ${imageUrls.length} cosplay images (from ${allSrcs.length} total)`);

  } catch (err) {
    console.error(`  Error: ${err.message}`);
  } finally {
    await page.close();
  }

  return imageUrls;
}

async function main() {
  const args = process.argv.slice(2);
  let startIdx = parseInt(args[0]) || 0;
  let endIdx = parseInt(args[1]) || characters.length;

  const charsDir = path.join(__dirname, 'chars');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
  });

  console.log(`Processing characters ${startIdx} to ${endIdx - 1} (${endIdx - startIdx} total)`);

  let totalUrls = 0;

  for (let i = startIdx; i < endIdx && i < characters.length; i++) {
    const char = characters[i];
    const charDir = path.join(charsDir, char.safe);

    if (!fs.existsSync(charDir)) {
      fs.mkdirSync(charDir, { recursive: true });
    }

    console.log(`[${i + 1}/${characters.length}] ${char.name} (${char.series})`);

    try {
      const urls = await searchCharacter(browser, char);

      const info = {
        name: char.name,
        series: char.series,
        safe_name: char.safe,
        anilist_img_id: char.img,
        official_art_url: `https://s4.anilist.co/file/anilistcdn/character/large/b${char.img}.jpg`,
        search_query: `${char.name} ${char.series} coser cos正片`,
        cosplay_image_urls: urls,
        url_count: urls.length,
        searched_at: new Date().toISOString()
      };

      fs.writeFileSync(path.join(charDir, 'info.json'), JSON.stringify(info, null, 2));
      totalUrls += urls.length;

    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`);
    }

    // Delay between searches
    if (i < endIdx - 1) {
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));
    }
  }

  await browser.close();
  console.log(`\n✅ Done! Total cosplay URLs found: ${totalUrls}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
