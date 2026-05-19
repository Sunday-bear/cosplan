const fs = require('fs');
const path = require('path');

// Known correct AniList character IDs
const chars = {
  'Rem':           {name:'蕾姆', id:'118763'},
  'Platelet':      {name:'血小板', id:'137312'},
  'Mitsuri Kanroji': {name:'甘露寺蜜璃', id:'157406'},
  'Kurumi Tokisaki': {name:'时崎狂三', id:'70668'},
  'Zero Two':      {name:'02', id:'124717'},
  'Violet Evergarden': {name:'薇尔莉特', id:'131578'},
  'Shinobu Kocho': {name:'蝴蝶忍', id:'150672'},
  'Asuna Yuuki':   {name:'亚丝娜', id:'3634'},
  'Artoria Pendragon': {name:'Saber', id:'2746'},
  'Emilia':        {name:'艾米莉亚', id:'118765'},
  'Ruri Gokou':    {name:'五更琉璃', id:'7901'},
  'Mikasa Ackerman': {name:'三笠·阿克曼', id:'40882'},
  'Yae Miko':      {name:'八重神子', id:'227380'},
  'Raiden Shogun': {name:'雷电将军', id:'211643'},
  'Nahida':        {name:'纳西妲', id:'251487'},
  'Kanna Kamui':   {name:'康娜', id:'86589'},
  'Tohru':         {name:'托尔', id:'86580'},
  'Satoru Gojo':   {name:'五条悟', id:'146520'},
  'Tanjiro Kamado': {name:'炭治郎', id:'145865'},
  'Levi':          {name:'利威尔', id:'45627'},
  'Osamu Dazai':   {name:'太宰治', id:'91383'},
  'Sasuke Uchiha': {name:'宇智波佐助', id:'13'},
  'Naruto Uzumaki': {name:'漩涡鸣人', id:'17'},
  'Sesshomaru':    {name:'杀生丸', id:'23976'},
  'Chuuya Nakahara': {name:'中原中也', id:'91385'},
  'Zhongli':       {name:'钟离', id:'208225'},
  'Nezuko Kamado': {name:'灶门祢豆子', id:'146156'},
  'Hu Tao':        {name:'胡桃', id:'215788'},
  'Keqing':        {name:'刻晴', id:'215796'},
  'Xiao':          {name:'魈', id:'215780'},
  'Wanderer':      {name:'散兵', id:'248681'},
  'Sakura Kinomoto': {name:'木之本樱', id:'1615'},
  'Anya Forger':   {name:'阿尼亚', id:'228717'},
  'Yor Forger':    {name:'约尔', id:'228721'},
  'Loid Forger':   {name:'黄昏', id:'228718'},
  'Inori Yuzuriha': {name:'楪祈', id:'43415'},
  'Eren Yeager':   {name:'艾伦·耶格尔', id:'40881'},
  'Ken Kaneki':    {name:'金木研', id:'87604'},
  'Tartaglia':     {name:'达达利亚', id:'208228'},
  'Ganyu':         {name:'甘雨', id:'208227'},
};

async function fetchById(id) {
  const query = `{Character(id:${id}){name{full}image{large}}}`;
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({query}),
  });
  const json = await res.json();
  return json.data?.Character || null;
}

async function main() {
  const dir = path.join(__dirname, 'images', 'characters');
  fs.mkdirSync(dir, {recursive: true});

  let ok = 0, fail = 0;
  const idMap = {};

  for (const [enName, cn] of Object.entries(chars)) {
    const filepath = path.join(dir, `${cn.id}.jpg`);
    if (fs.existsSync(filepath) && fs.statSync(filepath).size > 1000) {
      console.log(`✅ ${cn.name} (cached)`);
      idMap[cn.name] = cn.id;
      ok++;
      continue;
    }

    // Remove any bad cached file
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);

    const charData = await fetchById(cn.id);
    if (!charData || !charData.image?.large) {
      console.log(`⚠️  ${cn.name} (id:${cn.id}): no data - ${charData?.name?.full||'null'}`);
      fail++;
      continue;
    }

    try {
      const res = await fetch(charData.image.large);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(filepath, buf);
      console.log(`📥 ${cn.name} (id:${cn.id}, ${buf.length}b) ← ${charData.name.full}`);
      idMap[cn.name] = cn.id;
      ok++;
    } catch(e) {
      console.log(`❌ ${cn.name}: ${e.message}`);
      fail++;
    }
  }

  console.log(`\nDone: ${ok} ok, ${fail} failed`);
  fs.writeFileSync(path.join(__dirname, 'char-id-map.json'), JSON.stringify(idMap, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
