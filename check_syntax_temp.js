
// ═══════ STATE ═══════
let faceData = null;
let selected = {height:null,build:null,gender:null,budget:null};

const options = {
  height:[
    {v:'short',label:'155cm以下'},{v:'mid-low',label:'155-165cm'},{v:'mid',label:'165-175cm'},
    {v:'mid-high',label:'175-185cm'},{v:'tall',label:'185cm以上'},
  ],
  build:[
    {v:'slim',label:'偏瘦'},{v:'average',label:'标准'},{v:'athletic',label:'有肌肉'},{v:'soft',label:'偏圆润'},
  ],
  gender:[
    {v:'female',label:'女性角色'},{v:'male',label:'男性角色'},{v:'any',label:'不限'},
  ],
  budget:[
    {v:'low',label:'500以内'},{v:'mid-low',label:'500-1000'},{v:'mid',label:'1000-2000'},{v:'high',label:'2000+'},{v:'any',label:'不限'},
  ],
};

// ═══════ MODELS ═══════
const MODEL_URL = 'models';
let modelsLoaded = false;

async function loadModels() {
  if (modelsLoaded) return;
  showLoading('加载 AI 模型...');
  try {
    // Wait for face-api to be available (local file should be fast)
    let waited = 0;
    while (typeof faceapi === 'undefined' || !faceapi.nets) {
      if (waited > 40) throw new Error('face-api.js 加载超时');
      await new Promise(r => setTimeout(r, 500));
      waited++;
    }
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    modelsLoaded = true;
  } catch(e) {
    console.error('Model load error:', e);
    const msg = '⚠️ AI模型加载失败: ' + (e.message || '未知错误');
    showToast(msg);
  }
  hideLoading();
}

// ═══════ PHOTO CAPTURE ═══════
const captureBox = document.getElementById('captureBox');
const captureVideo = document.getElementById('captureVideo');
const captureCanvas = document.getElementById('captureCanvas');
const captureActions = document.getElementById('captureActions');

captureBox.addEventListener('click', () => {
  const inp = document.getElementById('fileInput');
  inp.value = ''; inp.click();
});

document.getElementById('fileInput').addEventListener('change', e => {
  if (e.target.files[0]) loadImageFile(e.target.files[0]);
});

document.getElementById('btnRetake').addEventListener('click', () => {
  faceData = null;
  captureCanvas.style.display = 'none';
  captureVideo.style.display = 'none';
  captureBox.classList.remove('has-photo');
  captureActions.style.display = 'none';
  document.getElementById('analysisBox').classList.remove('show');
  updateBtn();
});

function loadImageFile(file) {
  // Use native Image API (not faceapi) to avoid CDN dependency for preview
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    displayCapturedImage(img);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function displayCapturedImage(img) {
  const maxW = captureBox.clientWidth - 16;
  const maxH = 300;
  let w = img.width, h = img.height;
  if (w > maxW) { h = h * maxW / w; w = maxW; }
  if (h > maxH) { w = w * maxH / h; h = maxH; }
  captureCanvas.width = w; captureCanvas.height = h;
  const ctx = captureCanvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  captureCanvas.style.display = 'block';
  captureVideo.style.display = 'none';
  captureBox.classList.add('has-photo');
  captureActions.style.display = 'flex';
}

// ═══════ FACE ANALYSIS ═══════
document.getElementById('btnAnalyze').addEventListener('click', async () => {
  await loadModels();
  if (!modelsLoaded) return; // loadModels showed error toast already
  showLoading('分析面部特征...');
  try {
    const detection = await faceapi.detectSingleFace(captureCanvas, new faceapi.TinyFaceDetectorOptions({inputSize:320})).withFaceLandmarks();
    if (!detection) {
      showToast('😕 未检测到人脸，请拍一张清晰的正面照');
      hideLoading();
      return;
    }
    const lm = detection.landmarks;
    const jaw = lm.getJawOutline();
    const leftCheek = lm.getLeftEyeBrow()[0];
    const rightCheek = lm.getRightEyeBrow()[0];
    const chin = jaw[8]; // chin tip
    const forehead = {x: (lm.getLeftEyeBrow()[2].x + lm.getRightEyeBrow()[2].x)/2, y: Math.min(lm.getLeftEyeBrow()[0].y, lm.getRightEyeBrow()[0].y)};

    // Calculate metrics
    const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
    const faceHeight = Math.abs(chin.y - forehead.y);
    const fwFh = faceWidth / faceHeight; // face width/height ratio

    // Jaw width at ~60% down from forehead
    const jawLevel = forehead.y + faceHeight * 0.6;
    const jawLeft = jaw.find(p => Math.abs(p.y - jawLevel) < 10);
    const jawRight = [...jaw].reverse().find(p => Math.abs(p.y - jawLevel) < 10);
    let jawWidth = faceWidth;
    if (jawLeft && jawRight) jawWidth = Math.abs(jawRight.x - jawLeft.x);
    const jawRatio = jawWidth / faceWidth; // jaw/cheekbone ratio

    // Eye distance
    const leftEye = lm.getLeftEye();
    const rightEye = lm.getRightEye();
    const leftEyeC = {x: (leftEye[0].x+leftEye[3].x)/2, y: (leftEye[1].y+leftEye[4].y)/2};
    const rightEyeC = {x: (rightEye[0].x+rightEye[3].x)/2, y: (rightEye[1].y+rightEye[4].y)/2};
    const eyeDist = Math.abs(rightEyeC.x - leftEyeC.x) / faceWidth;

    // Determine face shape
    let faceShape = 'oval';
    if (fwFh > 0.85 && jawRatio > 0.85) faceShape = 'round';
    else if (fwFh > 0.85 && jawRatio <= 0.85) faceShape = 'square';
    else if (fwFh <= 0.85 && jawRatio <= 0.82) faceShape = 'heart';
    else if (fwFh <= 0.72) faceShape = 'long';
    else faceShape = 'oval';

    // Plumpness estimate (placeholder - would need pixel analysis)
    const fullness = fwFh > 0.82 ? 'soft' : (fwFh < 0.75 ? 'slim' : 'average');

    faceData = {faceShape, fwFh: parseFloat(fwFh.toFixed(3)), jawRatio: parseFloat(jawRatio.toFixed(3)), eyeDist: parseFloat(eyeDist.toFixed(3)), fullness, faceWidth, faceHeight};

    // Display results
    const shapeNames = {round:'圆脸',oval:'鹅蛋脸',square:'方脸',heart:'瓜子脸',long:'长脸'};
    const grid = document.getElementById('analysisGrid');
    grid.innerHTML = `
      <div class="analysis-item">脸型 <span class="val">${shapeNames[faceShape]}</span></div>
      <div class="analysis-item">宽高比 <span class="val">${fwFh.toFixed(2)}</span></div>
      <div class="analysis-item">下颌比 <span class="val">${jawRatio.toFixed(2)}</span></div>
      <div class="analysis-item">饱满度 <span class="val">${fullness==='soft'?'偏圆润':fullness==='slim'?'偏瘦':'标准'}</span></div>
    `;
    document.getElementById('analysisBox').classList.add('show');
    updateBtn();
    showToast('✅ 分析完成！选好身高体型开始诊断吧');
  } catch (e) {
    console.error(e);
    showToast('😕 分析出错，请重试');
  }
  hideLoading();
});

// ═══════ FORM CHIPS ═══════
['height','build','gender','budget'].forEach(k => {
  const row = document.getElementById(k+'Row');
  row.innerHTML = options[k].map(o => `<div class="chip" data-v="${o.v}" onclick="selectChip('${k}','${o.v}',this)">${o.label}</div>`).join('');
});

function selectChip(key, val, el) {
  selected[key] = val;
  document.querySelectorAll(`#${key}Row .chip`).forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  updateBtn();
}

function updateBtn() {
  const hasFace = faceData !== null;
  const hasHeight = selected.height !== null;
  document.getElementById('btnDiagnose').disabled = !(hasFace && hasHeight);
}

// ═══════ CHARACTER DB ═══════
const characters = [
  {name:'蕾姆',series:'Re:从零开始',gender:'female',height:'mid-low',build:'slim',face:'round',cost:'low',complexity:'低',img:'88575',tags:['女仆装','短发','经典']},
  {name:'血小板',series:'工作细胞',gender:'female',height:'short',build:'slim',face:'round',cost:'low',complexity:'低',img:'127417',tags:['制服','可爱','低门槛']},
  {name:'甘露寺蜜璃',series:'鬼灭之刃',gender:'female',height:'mid-low',build:'slim',face:'oval',cost:'mid-low',complexity:'中',img:'136072',tags:['和服','长发','人气']},
  {name:'时崎狂三',series:'约会大作战',gender:'female',height:'mid-low',build:'slim',face:'oval',cost:'mid-low',complexity:'中',img:'70069',tags:['哥特','双马尾','经典']},
  {name:'02',series:'DARLING in the FRANXX',gender:'female',height:'mid',build:'slim',face:'oval',cost:'low',complexity:'低',img:'124381',tags:['紧身衣','粉发','人气']},
  {name:'薇尔莉特',series:'紫罗兰永恒花园',gender:'female',height:'mid-low',build:'slim',face:'oval',cost:'high',complexity:'高',img:'90169',tags:['洋装','金发','精致']},
  {name:'蝴蝶忍',series:'鬼灭之刃',gender:'female',height:'mid-low',build:'slim',face:'oval',cost:'mid',complexity:'中',img:'150672',tags:['和服','蝴蝶发饰','优雅']},
  {name:'亚丝娜',series:'刀剑神域',gender:'female',height:'mid-low',build:'slim',face:'oval',cost:'mid',complexity:'中',img:'3634',tags:['战斗服','长发','经典']},
  {name:'Saber',series:'Fate系列',gender:'female',height:'mid-low',build:'slim',face:'oval',cost:'high',complexity:'高',img:'2746',tags:['铠甲','金发','经典']},
  {name:'艾米莉亚',series:'Re:从零开始',gender:'female',height:'mid',build:'slim',face:'oval',cost:'mid',complexity:'中',img:'88572',tags:['精灵','银发','优雅']},
  {name:'五更琉璃',series:'俺妹',gender:'female',height:'mid-low',build:'slim',face:'round',cost:'low',complexity:'低',img:'31008',tags:['哥特','黑长直','经典']},
  {name:'三笠·阿克曼',series:'进击的巨人',gender:'female',height:'mid',build:'athletic',face:'oval',cost:'mid-low',complexity:'中',img:'40881',tags:['军装','短发','飒']},
  {name:'八重神子',series:'原神',gender:'female',height:'mid',build:'slim',face:'oval',cost:'high',complexity:'高',img:'227380',tags:['和风','粉发','精致']},
  {name:'雷电将军',series:'原神',gender:'female',height:'mid',build:'slim',face:'oval',cost:'high',complexity:'高',img:'211643',tags:['和风','紫发','华丽']},
  {name:'纳西妲',series:'原神',gender:'female',height:'short',build:'slim',face:'round',cost:'mid',complexity:'中',img:'',tags:['精灵','可爱','小巧']},
  {name:'康娜',series:'小林家的龙女仆',gender:'female',height:'short',build:'soft',face:'round',cost:'low',complexity:'低',img:'86589',tags:['可爱','日常','低门槛']},
  {name:'托尔',series:'小林家的龙女仆',gender:'female',height:'mid',build:'slim',face:'oval',cost:'mid-low',complexity:'中',img:'120970',tags:['女仆','龙角','可爱']},
  {name:'五条悟',series:'咒术回战',gender:'male',height:'mid-high',build:'slim',face:'oval',cost:'mid',complexity:'中',img:'127691',tags:['制服','白毛','人气']},
  {name:'炭治郎',series:'鬼灭之刃',gender:'male',height:'mid',build:'athletic',face:'oval',cost:'mid',complexity:'中',img:'126071',tags:['和服','日轮刀','经典']},
  {name:'利威尔',series:'进击的巨人',gender:'male',height:'mid-low',build:'slim',face:'oval',cost:'mid-low',complexity:'中',img:'45627',tags:['军装','短发','人气']},
  {name:'太宰治',series:'文豪野犬',gender:'male',height:'mid',build:'slim',face:'oval',cost:'low',complexity:'低',img:'89198',tags:['风衣','绷带','低门槛']},
  {name:'宇智波佐助',series:'火影忍者',gender:'male',height:'mid',build:'slim',face:'oval',cost:'mid-low',complexity:'中',img:'13',tags:['忍者','黑发','经典']},
  {name:'漩涡鸣人',series:'火影忍者',gender:'male',height:'mid',build:'athletic',face:'oval',cost:'mid-low',complexity:'中',img:'17',tags:['忍者','金发','经典']},
  {name:'杀生丸',series:'犬夜叉',gender:'male',height:'mid-high',build:'slim',face:'long',cost:'mid',complexity:'中',img:'1358',tags:['和服','银发','高冷']},
  {name:'中原中也',series:'文豪野犬',gender:'male',height:'mid-low',build:'slim',face:'oval',cost:'low',complexity:'低',img:'89853',tags:['西装','帽子','低门槛']},
  {name:'钟离',series:'原神',gender:'male',height:'mid-high',build:'slim',face:'oval',cost:'high',complexity:'高',img:'208225',tags:['中式','西装','华丽']},
  {name:'灶门祢豆子',series:'鬼灭之刃',gender:'female',height:'mid-low',build:'slim',face:'round',cost:'mid-low',complexity:'中',img:'127518',tags:['和服','竹筒','可爱']},
  {name:'胡桃',series:'原神',gender:'female',height:'mid-low',build:'slim',face:'oval',cost:'mid',complexity:'中',img:'215788',tags:['中式','双马尾','活泼']},
  {name:'刻晴',series:'原神',gender:'female',height:'mid-low',build:'slim',face:'oval',cost:'mid',complexity:'中',img:'215796',tags:['中式','紫发','干练']},
  {name:'魈',series:'原神',gender:'male',height:'mid-low',build:'slim',face:'oval',cost:'mid',complexity:'中',img:'215780',tags:['中式','绿发','冷酷']},
  {name:'散兵',series:'原神',gender:'male',height:'mid-low',build:'slim',face:'oval',cost:'mid',complexity:'中',img:'',tags:['和风','紫发','人气']},
  {name:'木之本樱',series:'魔卡少女樱',gender:'female',height:'short',build:'slim',face:'round',cost:'mid-low',complexity:'中',img:'2671',tags:['魔法少女','可爱','经典']},
  {name:'阿尼亚',series:'间谍过家家',gender:'female',height:'short',build:'slim',face:'round',cost:'low',complexity:'低',img:'138100',tags:['日常','粉发','超人气']},
  {name:'约尔',series:'间谍过家家',gender:'female',height:'mid',build:'slim',face:'oval',cost:'mid-low',complexity:'中',img:'138102',tags:['日常','黑发','人气']},
  {name:'黄昏',series:'间谍过家家',gender:'male',height:'mid-high',build:'athletic',face:'square',cost:'low',complexity:'低',img:'138101',tags:['西装','金发','低门槛']},
  {name:'楪祈',series:'罪恶王冠',gender:'female',height:'mid-low',build:'slim',face:'oval',cost:'mid-low',complexity:'中',img:'43280',tags:['歌姬','粉发','经典']},
  {name:'艾伦·耶格尔',series:'进击的巨人',gender:'male',height:'mid',build:'athletic',face:'oval',cost:'mid',complexity:'中',img:'40882',tags:['军装','棕发','人气']},
  {name:'金木研',series:'东京食尸鬼',gender:'male',height:'mid',build:'slim',face:'oval',cost:'mid-low',complexity:'中',img:'87275',tags:['面具','白发','经典']},
  {name:'达达利亚',series:'原神',gender:'male',height:'mid-high',build:'athletic',face:'oval',cost:'high',complexity:'高',img:'209687',tags:['战斗服','橙发','华丽']},
  {name:'甘雨',series:'原神',gender:'female',height:'mid',build:'slim',face:'oval',cost:'high',complexity:'高',img:'233410',tags:['中式','蓝发','仙气']},
];

// ═══════ DYNAMIC MATCHING ENGINE ═══════
// Each character gets continuous face trait targets + categorized face shape
// Scoring uses continuous distance from user measurements → "alive" feel

// Seed-based pseudo-random for reproducible but varied results
function seededRandom(seed) {
  let s = seed;
  return function() { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

// Face trait targets for each face shape (continuous values)
const faceTraitMap = {
  round:  { fwFh: 0.88, jawRatio: 0.90, eyeDist: 0.44 },
  oval:   { fwFh: 0.78, jawRatio: 0.85, eyeDist: 0.46 },
  heart:  { fwFh: 0.82, jawRatio: 0.80, eyeDist: 0.48 },
  square: { fwFh: 0.86, jawRatio: 0.87, eyeDist: 0.45 },
  long:   { fwFh: 0.70, jawRatio: 0.83, eyeDist: 0.45 },
};

// Extended character traits for continuous scoring
const charTraits = {
  '蕾姆': { fwFh:0.88, jawRatio:0.90, eyeDist:0.45 },
  '血小板': { fwFh:0.90, jawRatio:0.92, eyeDist:0.48 },
  '甘露寺蜜璃': { fwFh:0.80, jawRatio:0.84, eyeDist:0.47 },
  '时崎狂三': { fwFh:0.78, jawRatio:0.84, eyeDist:0.46 },
  '02': { fwFh:0.76, jawRatio:0.82, eyeDist:0.46 },
  '薇尔莉特': { fwFh:0.77, jawRatio:0.84, eyeDist:0.45 },
  '蝴蝶忍': { fwFh:0.79, jawRatio:0.83, eyeDist:0.46 },
  '亚丝娜': { fwFh:0.78, jawRatio:0.84, eyeDist:0.46 },
  'Saber': { fwFh:0.77, jawRatio:0.84, eyeDist:0.45 },
  '艾米莉亚': { fwFh:0.78, jawRatio:0.83, eyeDist:0.45 },
  '五更琉璃': { fwFh:0.85, jawRatio:0.88, eyeDist:0.47 },
  '三笠·阿克曼': { fwFh:0.76, jawRatio:0.82, eyeDist:0.44 },
  '八重神子': { fwFh:0.79, jawRatio:0.83, eyeDist:0.46 },
  '雷电将军': { fwFh:0.80, jawRatio:0.84, eyeDist:0.45 },
  '康娜': { fwFh:0.92, jawRatio:0.94, eyeDist:0.49 },
  '托尔': { fwFh:0.80, jawRatio:0.85, eyeDist:0.46 },
  '五条悟': { fwFh:0.77, jawRatio:0.83, eyeDist:0.44 },
  '炭治郎': { fwFh:0.80, jawRatio:0.85, eyeDist:0.46 },
  '利威尔': { fwFh:0.75, jawRatio:0.81, eyeDist:0.44 },
  '太宰治': { fwFh:0.77, jawRatio:0.83, eyeDist:0.45 },
  '宇智波佐助': { fwFh:0.78, jawRatio:0.83, eyeDist:0.45 },
  '漩涡鸣人': { fwFh:0.81, jawRatio:0.86, eyeDist:0.47 },
  '杀生丸': { fwFh:0.72, jawRatio:0.82, eyeDist:0.43 },
  '中原中也': { fwFh:0.80, jawRatio:0.84, eyeDist:0.46 },
  '钟离': { fwFh:0.77, jawRatio:0.83, eyeDist:0.44 },
  '灶门祢豆子': { fwFh:0.86, jawRatio:0.88, eyeDist:0.48 },
  '胡桃': { fwFh:0.82, jawRatio:0.85, eyeDist:0.47 },
  '刻晴': { fwFh:0.78, jawRatio:0.83, eyeDist:0.46 },
  '魈': { fwFh:0.75, jawRatio:0.81, eyeDist:0.44 },
  '木之本樱': { fwFh:0.87, jawRatio:0.89, eyeDist:0.48 },
  '阿尼亚': { fwFh:0.94, jawRatio:0.93, eyeDist:0.50 },
  '约尔': { fwFh:0.78, jawRatio:0.83, eyeDist:0.45 },
  '黄昏': { fwFh:0.80, jawRatio:0.86, eyeDist:0.44 },
  '楪祈': { fwFh:0.79, jawRatio:0.83, eyeDist:0.46 },
  '艾伦·耶格尔': { fwFh:0.78, jawRatio:0.84, eyeDist:0.45 },
  '金木研': { fwFh:0.77, jawRatio:0.83, eyeDist:0.45 },
  '达达利亚': { fwFh:0.79, jawRatio:0.84, eyeDist:0.45 },
  '甘雨': { fwFh:0.78, jawRatio:0.83, eyeDist:0.45 },
  '纳西妲': { fwFh:0.88, jawRatio:0.89, eyeDist:0.48 },
  '散兵': { fwFh:0.77, jawRatio:0.82, eyeDist:0.45 },
};

// ═══════ SERIES COLOR PALETTE ═══════
const seriesColors = {
  'Re:从零开始':'135,180,255','鬼灭之刃':'34,211,238','约会大作战':'236,72,153',
  'DARLING in the FRANXX':'239,68,68','紫罗兰永恒花园':'168,162,255','刀剑神域':'250,204,21',
  'Fate系列':'59,130,246','俺妹':'168,85,247','进击的巨人':'168,162,158',
  '原神':'251,191,36','小林家的龙女仆':'74,222,128','咒术回战':'129,140,248',
  '文豪野犬':'71,85,105','火影忍者':'249,115,22','犬夜叉':'239,68,68',
  '魔卡少女樱':'244,114,182','间谍过家家':'34,197,94','罪恶王冠':'217,70,239',
  '东京食尸鬼':'139,92,246','工作细胞':'239,68,68',
};
const defaultColor = '124,58,237';

// Character key mapping for cosplay image paths
const charKeyMap = {
  '蕾姆':'rem','血小板':'platelet','甘露寺蜜璃':'kanroji_mitsuri','时崎狂三':'kurumi',
  '02':'zero_two','薇尔莉特':'violet','蝴蝶忍':'shinobu','亚丝娜':'asuna',
  'Saber':'saber','艾米莉亚':'emilia','五更琉璃':'kuroneko','三笠·阿克曼':'mikasa',
  '八重神子':'yae_miko','雷电将军':'raiden','纳西妲':'nahida','康娜':'kanna','托尔':'tohru',
  '五条悟':'gojo','炭治郎':'tanjiro','利威尔':'levi','太宰治':'dazai',
  '宇智波佐助':'sasuke','漩涡鸣人':'naruto','杀生丸':'sesshomaru','中原中也':'chuuya',
  '钟离':'zhongli','灶门祢豆子':'nezuko','胡桃':'hutao','刻晴':'keqing',
  '魈':'xiao','散兵':'scaramouche','木之本樱':'sakura',
  '阿尼亚':'anya','约尔':'yor','黄昏':'loid','楪祈':'inori',
  '艾伦·耶格尔':'eren','金木研':'kaneki','达达利亚':'tartaglia','甘雨':'ganyu',
};

function diagnose() {
  if (!faceData) return;
  const d = faceData;
  
  // Generate a session-unique seed for controlled randomness
  const sessionSeed = Date.now() % 1000000 + Math.floor(Math.random() * 500000);
  const rand = seededRandom(sessionSeed);
  
  const results = characters.map(char => {
    let score = 0, reasons = [];

    // Gender
    if (selected.gender && selected.gender !== 'any') {
      if (char.gender === selected.gender) { score += 20; reasons.push('性别匹配'); }
      else { score -= 100; return {char,score,reasons}; }
    }

    // === CONTINUOUS FACE SCORING (the "alive" engine) ===
    const ct = charTraits[char.name] || { fwFh:0.80, jawRatio:0.85, eyeDist:0.46 };
    
    // Face width/height ratio (most important)
    const fwFhDiff = Math.abs(d.fwFh - ct.fwFh);
    const fwFhScore = Math.max(0, 35 - fwFhDiff * 140); // perfect match = 35, 0.25 diff = 0
    score += fwFhScore;
    if (fwFhDiff < 0.03) reasons.push('脸型比例高度匹配');
    else if (fwFhDiff < 0.07) reasons.push('脸型接近');

    // Jaw ratio
    const jawDiff = Math.abs(d.jawRatio - ct.jawRatio);
    const jawScore = Math.max(0, 20 - jawDiff * 160);
    score += jawScore;
    if (jawDiff < 0.03) reasons.push('下颌轮廓完美契合');

    // Eye distance
    const eyeDiff = Math.abs(d.eyeDist - ct.eyeDist);
    const eyeScore = Math.max(0, 15 - eyeDiff * 200);
    score += eyeScore;
    if (eyeDiff < 0.02) reasons.push('眼距天然相似');

    // === RANDOMNESS FACTOR (the "alive" magic) ===
    // Each diagnosis session gets ±12% jitter on face scores
    const jitter = (rand() - 0.5) * 0.24; // -12% to +12%
    score = score * (1 + jitter);

    // Also add subtle categorical face shape bonus
    const faceBonus = (d.faceShape === char.face) ? 8 : 
      ((d.faceShape==='round'&&char.face==='oval')||(d.faceShape==='oval'&&char.face==='round')) ? 5 :
      ((d.faceShape==='heart'&&char.face==='oval')||(d.faceShape==='oval'&&char.face==='heart')) ? 4 : 0;
    score += faceBonus;
    if (faceBonus >= 8) reasons.push('脸型类别完美吻合');

    // Height
    if (char.height === selected.height) { score += 18; reasons.push('身高完美匹配'); }
    else {
      const hOrder = ['short','mid-low','mid','mid-high','tall'];
      const diff = Math.abs(hOrder.indexOf(char.height) - hOrder.indexOf(selected.height));
      if (diff === 1) { score += 10; reasons.push('身高接近'); }
      else if (diff === 2) score += 4;
    }

    // Build
    if (selected.build) {
      if (char.build === selected.build) { score += 12; reasons.push('体型契合'); }
      else if (char.build === 'average' && (selected.build==='slim'||selected.build==='soft')) { score += 6; }
      else if (char.build === 'slim' && selected.build==='average') { score += 6; }
    }

    // Budget
    if (selected.budget && selected.budget !== 'any') {
      if (char.cost === selected.budget) { score += 6; reasons.push('预算匹配'); }
    }

    return {char,score,reasons};
  }).filter(r => r.score > 0).sort((a,b) => b.score - a.score);

  document.getElementById('homeView').classList.remove('active');
  document.getElementById('resultView').classList.add('active');
  document.getElementById('matchCount').textContent = results.length;

  const shapeNames = {round:'圆脸',oval:'鹅蛋脸',square:'方脸',heart:'瓜子脸',long:'长脸'};
  const shapeDescs = {
    round:'柔和圆润的轮廓',oval:'温婉和谐的黄金比例',square:'英气利落的线条',
    heart:'精致小巧的下颌',long:'修长优雅的面庞'
  };
  const buildNames = {slim:'偏瘦',average:'标准',athletic:'有肌肉',soft:'偏圆润'};
  const hLabels = {short:'155cm以下','mid-low':'155-165cm','mid':'165-175cm','mid-high':'175-185cm',tall:'185cm以上'};
  
  // Build vivid matching narratives
  const resultsWithNarratives = results.map((r,i) => {
    const c = r.char;
    const maxScore = 100;
    const matchPct = Math.min(99, Math.round(r.score / maxScore * 95 + rand() * 4)); // tiny natural variation
    
    // Generate exciting matching story
    const parts = [];
    
    // Face match narrative (using continuous score)
    const fwFhDiff2 = Math.abs(d.fwFh - (charTraits[c.name]?.fwFh || 0.80));
    const fwFhScore2 = Math.max(0, 35 - fwFhDiff2 * 140);
    const jawDiff2 = Math.abs(d.jawRatio - (charTraits[c.name]?.jawRatio || 0.85));
    const jawScore2 = Math.max(0, 20 - jawDiff2 * 160);
    const eyeDiff2 = Math.abs(d.eyeDist - (charTraits[c.name]?.eyeDist || 0.46));
    const eyeScore2 = Math.max(0, 15 - eyeDiff2 * 200);
    const faceScore = fwFhScore2 + jawScore2 + eyeScore2;
    if (fwFhDiff2 < 0.03) {
      parts.push(`你的${shapeNames[faceData.faceShape]}${shapeDescs[faceData.faceShape]}，${c.face===faceData.faceShape?'与'+c.name+'的脸型如出一辙':'与'+c.name+'的脸型相互辉映'}，轮廓上天然契合`);
    } else if (faceScore >= 10) {
      parts.push(`你的${shapeNames[faceData.faceShape]}配上${c.name}的脸型，气质互补相辅相成`);
    }
    
    // Height narrative
    const hOrder = ['short','mid-low','mid','mid-high','tall'];
    const hDiff = Math.abs(hOrder.indexOf(c.height) - hOrder.indexOf(selected.height));
    if (hDiff === 0) {
      parts.push(`身高${hLabels[selected.height]}完全是${c.name}的天选之数，站在镜子前的那一刻你会发现——比例简直完美复刻`);
    } else if (hDiff === 1) {
      parts.push(`身高${hLabels[selected.height]}与${c.name}仅一线之隔，穿对鞋子就是满分还原`);
    }
    
    // Build narrative
    if (selected.build && c.build === selected.build) {
      parts.push(`你的${buildNames[selected.build]}体型与${c.name}的身材比例高度重合，出装后线条感浑然天成`);
    }
    
    // Fullness match
    if (faceData.fullness === 'soft' && c.face === 'round') {
      parts.push(`你的面部饱满柔和，${c.name}的圆润感正是需要这样的温柔气质`);
    }
    if (faceData.fullness === 'slim' && c.face === 'heart') {
      parts.push(`你的清瘦面庞搭配${c.name}的精致下颌，举手投足都是高级感`);
    }
    
    const narrative = parts.join('；') + '。';
    
    // Special highlight
    let highlight = '';
    if (matchPct >= 70) highlight = '💎 天选之人';
    else if (matchPct >= 50) highlight = '🌟 高度契合';
    else if (matchPct >= 30) highlight = '✨ 气质匹配';
    else highlight = '🎭 值得尝试';
    
    return {char:c, score:r.score, narrative, matchPct, highlight, isLocked:i>=3};
  });

  const list = document.getElementById('resultList');
  list.style.cssText = 'display:flex;flex-direction:column;gap:14px;margin-bottom:30px';
  
  list.innerHTML = resultsWithNarratives.map((r,i) => {
    const c = r.char;
    const safeKey = charKeyMap[c.name] || c.name.replace(/[·\s]/g, '').toLowerCase();
    const initialImg = c.img ? `images/characters/${c.img}.jpg` : '';
    const sc = seriesColors[c.series] || defaultColor;
    
    // Store for dynamic loading
    if (!window._charData) window._charData = {};
    window._charData[i] = {char: c, matchPct: r.matchPct, highlight: r.highlight, safeKey, narrative: r.narrative, tags: c.tags, costLabel: c.cost};
    
    // Build dynamic tag badges
    const tagBadges = c.tags.map(t => `<span class="tag">${t}</span>`).join('');
    
    return `
      <div class="char-card${r.isLocked?' premium':''}" data-charidx="${i}">
        <div class="card-top">
          <!-- Thumbnail: official art (loaded dynamically) -->
          <div class="thumbnail" style="background:radial-gradient(ellipse at 30% 20%,rgba(${sc},0.2),transparent 70%),linear-gradient(135deg,rgba(${sc},0.12),rgba(0,0,0,0.3))">
            <img class="thumb-official" id="thumb-${i}" src="${initialImg}" alt="${c.name}" loading="lazy" onerror="this.onerror=null;this.style.display='none';document.getElementById('thumb-${i}-fb').style.display='flex'">
            <div class="char-img-fallback" style="display:none;position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center" id="thumb-${i}-fb">
              <span style="font-size:32px;font-weight:800;color:rgba(255,255,255,0.2)">${c.name[0]}</span>
              <span style="font-size:9px;color:rgba(255,255,255,0.3)">${c.series}</span>
            </div>
            <span class="match-pct-badge">${r.matchPct}%</span>
          </div>
          <div class="info">
            <div class="char-name">${c.name} <span style="font-size:10px;color:#ff9ec4;font-weight:600;margin-left:4px">${r.highlight}</span></div>
            <div class="char-title">${c.series}</div>
            <div class="match-bar-bg"><div class="match-bar-fill" style="width:${r.matchPct}%"></div></div>
            <div class="seed-line"><span>💫</span> ${r.narrative}</div>
          </div>
        </div>
        <!-- Cos strip: dynamically loaded cosplay photos -->
        <div class="cos-strip" id="cosstrip-${i}">
          <div class="cos-strip-placeholder">⏳ 加载真人Cos图...</div>
        </div>
        <div class="card-cta">
          <div class="tags">
            ${tagBadges}
          </div>
          <span class="arrow" onclick="event.stopPropagation();showDetail(${i})">→</span>
        </div>
      </div>`;
  }).join('');

  if (results.length > 3) {
    list.innerHTML += `
      <div class="lock-banner">
        <div class="lock-icon">🔒</div>
        <div class="lock-title">解锁全部 ${results.length} 个角色</div>
        <div class="lock-desc">完整匹配列表 + 动态cos种草图 + 角色速通卡<br>含购买渠道、省钱平替、OOC避雷指南</div>
        <button class="btn-unlock" onclick="showToast('💰 9.9元解锁全部（支付功能开发中）')">✨ 9.9 解锁全部</button>
      </div>`;
  }

  // === DYNAMIC COSPLAY IMAGE LOADING ===
  // Fetch real cosplay images for top 3 (free) results
  setTimeout(() => {
    for (let i = 0; i < Math.min(3, resultsWithNarratives.length); i++) {
      loadDynamicCosplay(i);
    }
  }, 300);

  window.scrollTo({top:0,behavior:'smooth'});
}

// API base — our VPS backend (Pixiv search via FastAPI)
const apiBase = 'https://api.cosplan.top';

// SiliconFlow API key for AI image generation
const SF_KEY = 'sk-fbqtxckrosedzhbvwbkpcrrjqojeyurahmbxzrchpqijvitv';

// Cache for AI-generated images: charName -> image URL
var aiImageCache = {};

// Character-specific prompt details for AI generation
var charPrompts = {
  '蕾姆': 'short blue hair with left swept bangs, white maid headband, blue eyes, pale skin, blue-white maid dress with apron',
  '血小板': 'short light blue hair, red eyes, cute child face, white lab coat, medical cap',
  '甘露寺蜜璃': 'long pink hair with green streaks, pink-green eyes, beauty mark, smiling',
  '时崎狂三': 'long black and red hair, red-gold eyes, clock eye, gothic dress',
  '02': 'long pink hair, red horns, blue eyes, confident smirk, pilot suit',
  '薇尔莉特': 'long blonde hair, blue eyes, blue dress, white gloves, brooch',
  '托尔': 'long blonde hair, green eyes, dragon tail, maid outfit, cheerful',
  '康娜': 'short white hair, purple eyes, chubby face, light blue dress, cute',
  '蝴蝶忍': 'short dark purple hair, purple eyes, calm smile, butterfly hairpin, haori',
  '灶门祢豆子': 'long black hair with pink ends, pink eyes, bamboo muzzle, pink kimono',
  '胡桃': 'brown hair in twin braids, yellow eyes, witch hat, black-red outfit',
  '刻晴': 'long purple hair in bun with ponytail, elegant Chinese dress',
  '甘雨': 'long blue hair with red streak, blue eyes, half-rim glasses, qipao',
  '纳西妲': 'short white hair with green leaves, green eyes, tiny white dress',
  '雷电将军': 'long purple hair in braid, purple eyes, stoic, kimono with armor',
  '温迪': 'short black-blue hair with braids, green eyes, bard outfit, lyre',
  '芙宁娜': 'long white-blue hair with hat, blue heterochromia, white-blue elegant outfit',
  '亚丝娜': 'long chestnut hair, hazel eyes, red-white knight outfit, cute',
  '御坂美琴': 'short brown hair, hazel eyes, tsundere, school uniform with tie',
  '雪之下雪乃': 'long black hair, blue eyes, cold beauty, school uniform',
  '由比滨结衣': 'short pink hair with hairband, red eyes, cheerful, school uniform',
  '宝多六花': 'short black-blue hair, blue eyes, school uniform with jacket',
  '新条茜': 'long purple hair with red streak, yellow eyes, glasses, school uniform',
  '妮可罗宾': 'long black hair, blue eyes, intellectual, hat, coat',
  '娜美': 'long orange hair, brown eyes, confident, crop top, tattoo',
  '五条悟': 'white hair, blindfold, tall, black coat, confident smirk',
  '炭治郎': 'dark red hair with scar on forehead, red eyes, green checkered haori',
  '利威尔': 'short black hair, gray eyes, short stature, serious face, cravat',
  '太宰治': 'brown messy hair, brown eyes, bandages on face, beige coat',
  '宇智波佐助': 'black spiky hair, dark blue eyes, stoic, blue-white outfit',
  '漩涡鸣人': 'blonde spiky hair, blue eyes, whisker marks, orange jumpsuit',
  '杀生丸': 'long silver-white hair, golden eyes, crescent moon, white fur',
  '中原中也': 'orange-red hair, blue eyes, black hat, coat, short stature',
  '钟离': 'long brown hair with amber eyes, brown suit, elegant, geo symbol',
  '魈': 'short dark hair with green tips, golden eyes, mask, green-black outfit',
  '散兵': 'dark blue short hair, purple eyes, hat, veil, blue-white outfit',
  '黄昏': 'blonde hair, blue eyes, suit, spy look, calm expression',
  '艾伦耶格尔': 'medium brown hair, turquoise eyes, determined, survey corps jacket',
  '金木研': 'white hair, red-black eyes, eyepatch, black coat, mask',
  '达达利亚': 'orange hair, blue eyes, smirk, gray-blue outfit, water blade',
};

function getCharPrompt(charName) {
  var props = charPrompts[charName];
  if (props) {
    return 'anime character portrait of ' + charName + ', ' + props + ', official art style, anime illustration, clean high quality, front view, bright lighting';
  }
  if (charName.match(/[\u4e00-\u9fff]/)) {
    return 'anime character portrait, ' + charName + ', anime style, official art, high quality anime illustration, front view';
  }
  return 'anime character portrait, high quality anime art, cute determined expression, clean illustration, front view';
}

async function generateCharImage(charName) {
  // Check cache first
  if (aiImageCache[charName]) return aiImageCache[charName];
  
  var prompt = getCharPrompt(charName);
  
  try {
    var resp = await fetch('https://api.siliconflow.cn/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SF_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'Tongyi-MAI/Z-Image-Turbo',
        prompt: prompt,
        n: 1
      }),
      signal: AbortSignal.timeout(30000)
    });
    if (!resp.ok) return null;
    var data = await resp.json();
    var images = data.images || [];
    if (images.length === 0) return null;
    var url = images[0].url;
    aiImageCache[charName] = url;
    return url;
  } catch(e) {
    console.error('AI generate error:', e);
    return null;
  }
}

// Load dynamic images for a character card: AI generated thumbnails + cosplay strip
async function loadDynamicCosplay(idx) {
  const data = window._charData?.[idx];
  if (!data) return;
  const {char, matchPct, safeKey} = data;
  
  const card = document.querySelector('.char-card[data-charidx="' + idx + '"]');
  if (!card) return;
  
  const thumbEl = document.getElementById('thumb-' + idx);
  const cosStrip = document.getElementById('cosstrip-' + idx);
  
  // Step 1: Generate AI character portrait for the thumbnail
  if (thumbEl) {
    var aiUrl = await generateCharImage(char.name);
    if (aiUrl) {
      thumbEl.src = aiUrl;
      thumbEl.style.display = 'block';
      var fb = document.getElementById('thumb-' + idx + '-fb');
      if (fb) fb.style.display = 'none';
    }
  }
  
  // Step 2: Search for real cosplay photos via Worker API
  try {
    try {
      var cosRes = await fetch(apiBase + '/search', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({character: char.name, count: 7}),
        signal: AbortSignal.timeout(15000)
      });
      if (cosRes.ok) {
        var cosData = await cosRes.json();
        var cosImages = cosData.images || [];
        if (cosImages.length > 0 && cosStrip) {
          var showCount = Math.min(cosImages.length, 7);
          var cosHtml = '';
          for (var ci = 0; ci < showCount; ci++) {
            var imgUrl = apiBase + cosImages[ci].url;
            cosHtml += '<img src="' + imgUrl + '" style="height:100%;width:auto;border-radius:8px" loading="lazy" onerror="this.style.display=\'none\'">';
          }
          if (cosImages.length > 7) {
            cosHtml += '<div class="cos-more">+' + (cosImages.length - 7) + '</div>';
          }
          cosStrip.innerHTML = cosHtml;
        }
      }
    } catch(e) {
      // Cos search failed, placeholder stays
    }
  } catch(e) {
    // Cos search failed, placeholder stays
  }
}

function goHome() {
  document.getElementById('resultView').classList.remove('active');
  document.getElementById('homeView').classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
}

// ═══════ DETAIL VIEW ═══════

function showDetail(idx) {
  var data = window._charData[idx];
  if (!data) return;
  var c = data.char;
  var heroImg = (c.img ? 'images/characters/' + c.img + '.jpg' : '');
  var tagsHtml = data.tags.map(function(t) {
    return '<span style="font-size:11px;padding:5px 14px;border-radius:16px;background:rgba(255,107,157,.08);color:#ff6b9d;border:1px solid rgba(255,107,157,.1)">' + t + '</span>';
  }).join('');
  var highlight = data.highlight || '💎 天选之人';
  var narr = (data.narrative || '').substring(0, 30);
  var deg = data.matchPct * 3.6;
  
  var html = '';
  html += '<div class="hero" style="position:relative;width:100%;height:360px;overflow:hidden;border-radius:16px 16px 0 0;background:linear-gradient(180deg, #1a1020 0%, #0d1825 40%, #111118 100%)">';
  html += '<img src="' + heroImg + '" alt="' + c.name + '" style="width:100%;height:100%;object-fit:cover;filter:brightness(0.75) saturate(1.1)" onerror="this.style.display=\'none\'">';
  html += '<div class="gradient-overlay" style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(17,17,24,.1) 60%,rgba(17,17,24,.85) 90%,#111118 100%)"></div>';
  html += '<span class="seed-badge" style="position:absolute;top:20px;right:20px;background:linear-gradient(135deg,#ff6b9d,#c44dff);color:#fff;font-size:11px;font-weight:700;padding:6px 16px;border-radius:20px;z-index:3;box-shadow:0 4px 20px rgba(196,77,255,.3)">🔥 ' + highlight + '</span>';
  html += '<div class="title-block" style="position:absolute;bottom:24px;left:20px;right:20px;z-index:2">';
  html += '<h1 style="font-size:36px;font-weight:900;color:#fff;letter-spacing:2px;text-shadow:0 2px 20px rgba(0,0,0,.5);margin-bottom:4px">' + c.name + '</h1>';
  html += '<p style="font-size:13px;color:rgba(255,255,255,0.5)">' + c.series + '</p></div></div>';
  
  // Detail content
  html += '<div class="detail-content" style="background:#111118;border-radius:0 0 16px 16px;padding:4px 0 20px">';
  
  // Match score ring
  html += '<div style="text-align:center;padding:24px 20px 12px">';
  html += '<div style="display:inline-flex;align-items:center;gap:14px">';
  html += '<div style="width:72px;height:72px;border-radius:50%;background:conic-gradient(#c44dff 0deg ' + deg + 'deg, rgba(255,255,255,.04) ' + deg + 'deg 360deg);display:flex;align-items:center;justify-content:center;position:relative">';
  html += '<div style="position:absolute;width:54px;height:54px;border-radius:50%;background:#0a0a0f"></div>';
  html += '<span style="position:relative;z-index:1;font-size:22px;font-weight:900;color:#fff">' + data.matchPct + '%</span></div>';
  html += '<div style="text-align:left;font-size:13px;color:#999;line-height:1.6"><strong style="color:#c44dff;font-size:15px">' + highlight + '</strong><br>' + narr + '...</div>';
  html += '</div></div>';
  
  // Official art section - 大图
  html += '<div class="section-label" style="display:flex;align-items:center;gap:10px;padding:20px 16px 12px">';
  html += '<span style="width:28px;height:28px;border-radius:8px;background:rgba(255,204,0,.15);display:flex;align-items:center;justify-content:center">🎨</span>';
  html += '<span style="font-size:16px;font-weight:700">官方立绘</span></div>';
  html += '<div class="official-card" style="margin:0 12px 12px;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.05);box-shadow:0 8px 30px rgba(0,0,0,.3)">';
  html += '<img id="detailOfficial" src="' + heroImg + '" alt="' + c.name + '" style="width:100%;display:block" onerror="this.style.display=\'none\'">';
  html += '<div class="caption" style="padding:10px 14px;background:rgba(255,255,255,.03);font-size:11px;color:#888"><span style="width:4px;height:4px;background:#ffcc00;border-radius:50%;display:inline-block;margin-right:6px"></span>' + c.series + ' · ' + c.name + '</div></div>';
  
  // Cosplay grid
  html += '<div class="section-label" style="display:flex;align-items:center;gap:10px;padding:20px 16px 12px">';
  html += '<span style="width:28px;height:28px;border-radius:8px;background:rgba(255,107,157,.15);display:flex;align-items:center;justify-content:center">📸</span>';
  html += '<span style="font-size:16px;font-weight:700">真人Cosplay</span>';
  html += '<span style="font-size:12px;color:#666;margin-left:auto" id="cosCountLabel">搜索中...</span></div>';
  html += '<div class="cos-grid" id="detailCosGrid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 12px 8px">';
  html += '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#555;font-size:13px">⏳ 正在加载真人Cos图...</div></div>';
  
  // Tags & CTA
  html += '<div style="margin:16px 12px;padding:20px;background:linear-gradient(135deg,rgba(255,107,157,.08),rgba(196,77,255,.08));border-radius:16px;border:1px solid rgba(255,107,157,.15)"><div style="display:flex;flex-wrap:wrap;gap:8px">' + tagsHtml + '</div></div>';
  html += '</div>';
  
  document.getElementById('detailContent').innerHTML = html;
  document.getElementById('resultView').classList.remove('active');
  document.getElementById('detailView').classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
  // Try to load AI-generated image for hero
  generateCharImage(c.name).then(function(aiUrl) {
    if (aiUrl) {
      var heroImgEl = document.querySelector('#detailContent .hero img');
      if (heroImgEl) heroImgEl.src = aiUrl;
    }
  });
  
  loadDetailCosplay(idx);
}

function closeDetail() {
  document.getElementById('detailView').classList.remove('active');
  document.getElementById('resultView').classList.add('active');
}

async function loadDetailCosplay(idx) {
  var data = window._charData[idx];
  if (!data) return;
  var api = (typeof apiBase !== 'undefined') ? apiBase : '';
  var images = [];
  try {
    var res = await fetch(api + '/search', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({character: data.char.name, count: 8}),
      signal: AbortSignal.timeout(15000)
    });
    if (res.ok) {
      var result = await res.json();
      images = result.images || [];
    }
  } catch(e) {}
  var grid = document.getElementById('detailCosGrid');
  var label = document.getElementById('cosCountLabel');
  if (images.length === 0) {
    if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#555;font-size:13px">暂无真人Cos图</div>';
    if (label) label.textContent = '暂无'; return;
  }
  if (label) label.textContent = images.length + '张';
  var cosHtml = '';
  var maxCos = Math.min(images.length, 8);
  for (var ci = 0; ci < maxCos; ci++) {
    var imgUrl = api + images[ci].url;
    cosHtml += '<div class="cos-item" style="border-radius:12px;overflow:hidden;aspect-ratio:3/4;position:relative;border:1px solid rgba(255,255,255,.04)">';
    cosHtml += '<img src="' + imgUrl + '" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.parentElement.style.display=\'none\'"></div>';
  }
  if (grid) grid.innerHTML = cosHtml;
  } catch(e) {
    var g = document.getElementById('detailCosGrid');
    if (g) g.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#555;font-size:13px">加载失败，请检查网络</div>';
  }
}

// ═══════ UTILS ═══════
function showToast(msg) {
  const t = document.getElementById('toast');t.textContent=msg;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2000);
}
let loadingTimer = null;
function showLoading(msg) {
  document.getElementById('loadingText').textContent=msg;
  document.getElementById('loadingOverlay').classList.remove('hidden');
  // Safety timeout: hide loading after 20s
  if (loadingTimer) clearTimeout(loadingTimer);
  loadingTimer = setTimeout(() => { hideLoading(); showToast('⚠️ 加载超时，请检查网络后重试'); }, 40000);
}
function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
}
function updateBtn() {
  const hasFace = faceData !== null;
  const hasHeight = selected.height !== null;
  document.getElementById('btnDiagnose').disabled = !(hasFace && hasHeight);
}
document.getElementById('btnDiagnose').addEventListener('click',diagnose);

// Models will be loaded on-demand when user uploads a photo (in loadImageFile)
