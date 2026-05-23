// Search Baidu Images for cosplay photos and extract sinaimg.cn / hdslb.com URLs
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function searchCharacter(charName, seriesName, outputDir, maxImages = 6) {
  const query = encodeURIComponent(`${charName} ${seriesName} coser cos正片`);
  const url = `https://image.baidu.com/search/index?tn=baiduimage&word=${query}`;
  
  console.log(`\n🔍 Searching: ${charName} (${seriesName})`);
  console.log(`   URL: ${url}`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  let imageUrls = [];
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for images to load
    await page.waitForSelector('img.main_img', { timeout: 10000 }).catch(() => {
      console.log('   ⚠️ No main_img found, trying alt selectors...');
    });
    
    // Scroll to load more images
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await new Promise(r => setTimeout(r, 1000));
    }
    
    // Extract image URLs
    const allUrls = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img.main_img, img.img-hover, .imgbox img');
      const urls = [];
      imgs.forEach(img => {
        const src = img.src || img.getAttribute('data-imgurl') || '';
        if (src && (src.includes('sinaimg.cn') || src.includes('hdslb.com'))) {
          urls.push(src);
        }
      });
      return urls;
    });
    
    console.log(`   Found ${allUrls.length} matching image URLs`);
    
    // Also try to get URLs from data attributes on all images
    const moreUrls = await page.evaluate(() => {
      const urls = [];
      // Check all img elements
      document.querySelectorAll('img').forEach(img => {
        for (const attr of ['src', 'data-imgurl', 'data-src', 'data-original']) {
          const val = img.getAttribute(attr);
          if (val && (val.includes('sinaimg.cn') || val.includes('hdslb.com'))) {
            urls.push(val);
          }
        }
      });
      // Also check background images and other elements
      document.querySelectorAll('[style*="url("]').forEach(el => {
        const match = el.style.backgroundImage?.match(/url\(["']?([^"')]+)["']?\)/);
        if (match && (match[1].includes('sinaimg.cn') || match[1].includes('hdslb.com'))) {
          urls.push(match[1]);
        }
      });
      return urls;
    });
    
    imageUrls = [...new Set([...allUrls, ...moreUrls])].filter(url => {
      // Skip very small thumbnails
      if (url.includes('thumbnail') || url.includes('thumb')) {
        // Keep but note
      }
      return url.startsWith('http');
    });
    
    console.log(`   Total unique URLs: ${imageUrls.length}`);
    
  } catch (err) {
    console.error(`   ❌ Error: ${err.message}`);
  } finally {
    await browser.close();
  }
  
  // Save URLs to file
  const infoPath = path.join(outputDir, 'image_urls.json');
  fs.writeFileSync(infoPath, JSON.stringify({ charName, seriesName, query: `${charName} ${seriesName} coser cos正片`, imageUrls, timestamp: new Date().toISOString() }, null, 2));
  console.log(`   📁 Saved ${imageUrls.length} URLs to ${infoPath}`);
  
  return imageUrls;
}

// Parse character list
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

async function main() {
  const args = process.argv.slice(2);
  let startIdx = 0;
  let endIdx = characters.length;
  
  if (args.length >= 1) startIdx = parseInt(args[0]);
  if (args.length >= 2) endIdx = parseInt(args[1]);
  
  const charsDir = path.join(__dirname, 'chars');
  
  console.log(`Processing characters ${startIdx} to ${endIdx - 1} (total: ${endIdx - startIdx})`);
  
  for (let i = startIdx; i < endIdx && i < characters.length; i++) {
    const char = characters[i];
    const charDir = path.join(charsDir, char.safe);
    
    if (!fs.existsSync(charDir)) {
      fs.mkdirSync(charDir, { recursive: true });
    }
    
    console.log(`\n[${i + 1}/${characters.length}] ${char.name} (${char.series})`);
    
    try {
      const urls = await searchCharacter(char.name, char.series, charDir, 6);
      
      // Also save the character info
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
      
    } catch (err) {
      console.error(`   ❌ Failed: ${err.message}`);
    }
    
    // Small delay between searches
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
  }
  
  console.log('\n✅ All searches complete!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
