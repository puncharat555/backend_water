/* ===== Water Dashboard (แก้ให้ตรง HTML นี้) ===== */
/* ใช้กับ:
   - <canvas id="waterLevelChart30d">
   - <canvas id="waterLevelChart1h">
   - <canvas id="batteryChart">, <canvas id="currentChart">
   - ปุ่มช่วงเวลา: #timeRangeButtons, #batteryTimeRangeButtons, #currentTimeRangeButtons
*/

let waterLevelChartInstance = null;
let oneHourChartInstance = null;
let batteryChartInstance = null;
let currentChartInstance = null;

const fixedDepth = 120;

/* ---------- Utils ---------- */
function setupHiDPICanvas(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);
  return ctx;
}

function toNum(v) {
  if (v === null || v === undefined) return NaN;
  const n = parseFloat(String(v).replace(/,/g, ' ').split(' ')[0]);
  return Number.isFinite(n) ? n : NaN;
}
function parseToDate(s) {
  if (!s) return null;
  s = String(s).trim();
  let m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(:\d{2})?)$/);
  if (m) return new Date(`${m[1]}T${m[2].length === 5 ? m[2] + ':00' : m[2]}`);
  m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})\.\d+$/);
  if (m) return new Date(`${m[1]}T${m[2]}:00`);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function yBoundsFromData(points, pad = 0.1) {
  if (!points || points.length === 0) return { min: 0, max: 50 };
  const ys = points.map(p => p.y);
  const min = Math.min(...ys), max = Math.max(...ys);
  const span = Math.max(1, max - min), extra = span * pad;
  return {
    min: Math.floor((min - extra) * 10) / 10,
    max: Math.ceil((max + extra) * 10) / 10
  };
}
function xScaleOpts(range, xMin, xMax) {
  const MAP = { '1h':{unit:'minute',step:5}, '1d':{unit:'hour',step:2}, '7d':{unit:'day',step:1}, '30d':{unit:'day',step:2} };
  const cfg = MAP[range] || { unit:'day', step:1 };
  return {
    type:'time', bounds:'data',
    min: xMin ?? undefined, max: xMax ?? undefined, offset:false,
    time:{ unit:cfg.unit, stepSize:cfg.step, round:cfg.unit, displayFormats:{minute:'HH:mm',hour:'HH:mm',day:'MMM d'} },
    ticks:{ color:'white' }, grid:{ color:'rgba(255,255,255,0.22)' },
    title:{ display:true, text:'เวลา (Time)', color:'white' }
  };
}

/* ---------- Data (ใส่ API จริงของคุณแทนได้) ---------- */
function fmtTime(ts) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
async function fetchLatestData() {
  return fetch('/api/latest').then(r=>r.json()).catch(() => ({
    distance: 65, v_node1: 12.4, i_node1: 0.23, v_node2: 12.5, i_node2: 0.18,
    time_node1: fmtTime(Date.now()), time_node2: fmtTime(Date.now())
  }));
}
async function fetchHistoricalData(range='1d') {
  const url = `/api/history?range=${encodeURIComponent(range)}`;
  return fetch(url).then(r=>r.json()).catch(() => {
    // mock สำหรับทดสอบ
    const now = Date.now();
    const step = (range==='1h') ? 5*60e3 : 60*60e3;
    const n = (range==='1h')? 12 : (range==='1d')? 24 : (range==='7d')? 42 : 120;
    const rows = [];
    for (let i=n-1;i>=0;i--){
      const t = new Date(now - i*step);
      rows.push({
        time_node1: fmtTime(t), time_node2: fmtTime(t),
        distance: 60 + Math.sin(i/5)*5 + (Math.random()*2-1),
        v_node1: 12.0 + Math.random()*0.6,
        v_node2: 12.1 + Math.random()*0.5,
        i_node1: Math.random()*0.5,
        i_node2: Math.random()*0.4
      });
    }
    return rows;
  });
}
function parseChartData(rows) {
  const water = [], v1 = [], v2 = [], i1 = [], i2 = [];
  for (const item of rows) {
    const ts = parseToDate(item.time_node1 || item.time_node2);
    if (!ts) continue;
    const d = toNum(item.distance);
    const level = Number.isFinite(d) ? Number((fixedDepth - d).toFixed(2)) : NaN;
    if (!Number.isNaN(level) && level >= 0 && level <= 100) water.push({ x: ts, y: level });
    const _v1 = toNum(item.v_node1), _v2 = toNum(item.v_node2);
    const _i1 = toNum(item.i_node1), _i2 = toNum(item.i_node2);
    if (Number.isFinite(_v1)) v1.push({ x: ts, y: _v1 });
    if (Number.isFinite(_v2)) v2.push({ x: ts, y: _v2 });
    if (Number.isFinite(_i1)) i1.push({ x: ts, y: _i1 });
    if (Number.isFinite(_i2)) i2.push({ x: ts, y: _i2 });
  }
  return { water, v1, v2, i1, i2 };
}

/* ---------- Charts ---------- */
// กราฟระดับน้ำย้อนหลัง (ใช้ canvas id="waterLevelChart30d")
function createWaterLevelChart(range, dataPoints) {
  const canvas = document.getElementById('waterLevelChart30d');
  if (!canvas) { console.warn('missing #waterLevelChart30d'); return; }
  const ctx = setupHiDPICanvas(canvas);
  if (!ctx) return;
  if (waterLevelChartInstance) waterLevelChartInstance.destroy();

  const yB = yBoundsFromData(dataPoints, 0.1);
  waterLevelChartInstance = new Chart(ctx, {
    type:'line',
    data:{ datasets:[{
      label:`ระดับน้ำ (cm) ${range}`,
      data:dataPoints,
      borderColor:'#4fc3f7', backgroundColor:'rgba(79,195,247,0.2)',
      fill:true, tension:0.3, pointRadius:(dataPoints.length===1?3:0),
      cubicInterpolationMode:'monotone'
    }]},
    options:{
      parsing:false, spanGaps:true,
      scales:{ x:xScaleOpts(range), y:{ min:yB.min, max:yB.max, ticks:{color:'white'}, grid:{color:'rgba(255,255,255,0.12)'}, title:{display:true,text:'ระดับน้ำ (cm)',color:'white'} } },
      plugins:{ legend:{labels:{color:'white'}}, tooltip:{mode:'index',intersect:false},
        subtitle:{ display:dataPoints.length<2, text:dataPoints.length===0?'ไม่มีข้อมูลในช่วงนี้':'มีข้อมูลเพียง 1 จุด', color:'#ddd' } },
      responsive:true, maintainAspectRatio:false
    }
  });
}

// กราฟ 1 ชั่วโมง (fallback อิงเวลาจาก record ล่าสุด)
async function createOneHourChart() {
  const canvas = document.getElementById('waterLevelChart1h');
  if (!canvas) { console.warn('missing #waterLevelChart1h'); return; }
  const ctx = setupHiDPICanvas(canvas);
  if (!ctx) return;
  try{
    let rows = await fetchHistoricalData('1h');
    let { water } = parseChartData(rows);
    water.sort((a,b)=>a.x-b.x);

    if (water.length === 0) {
      const rowsWide = await fetchHistoricalData('30d');
      const allWater = parseChartData(rowsWide).water.sort((a,b)=>a.x-b.x);
      const latestTs = allWater.at(-1)?.x;
      if (latestTs) {
        const start = new Date(latestTs.getTime() - 60*60*1000);
        water = allWater.filter(p => p.x >= start && p.x <= latestTs);
        if (water.length === 0) water = [{ x: latestTs, y: allWater.at(-1).y }];
      }
    }

    const has = water.length>0;
    const xMin = has ? water[0].x : new Date(Date.now()-60*60*1000);
    const xMax = has ? water.at(-1).x : new Date();
    const yB  = has ? yBoundsFromData(water, 0.08) : {min:0,max:50};

    if (oneHourChartInstance) oneHourChartInstance.destroy();
    oneHourChartInstance = new Chart(ctx, {
      type:'line',
      data:{ datasets:[{
        label:'ระดับน้ำ (cm) 1 ชั่วโมง (อิงข้อมูลล่าสุด)',
        data:water, borderColor:'#0f0', backgroundColor:'rgba(29,233,29,0.18)',
        fill:true, tension:0.3, pointRadius:(water.length===1?3:0), cubicInterpolationMode:'monotone'
      }]},
      options:{
        parsing:false, spanGaps:20*60*1000,
        scales:{ x:xScaleOpts('1h', xMin, xMax), y:{ min:yB.min, max:yB.max, ticks:{color:'white'}, grid:{color:'rgba(255,255,255,0.12)'} } },
        plugins:{ legend:{labels:{color:'white'}}, tooltip:{mode:'index',intersect:false},
          subtitle:{ display:!has, text:'ไม่พบข้อมูล 1 ชั่วโมงล่าสุด — กำลังรอข้อมูลใหม่', color:'#ddd' } },
        responsive:true, maintainAspectRatio:false
      }
    });
  }catch(e){ console.error('1h chart error', e); }
}

// แบต/กระแส (เปลี่ยนสเกลตาม range ปุ่ม)
function createBatteryCurrentCharts(v1, v2, i1, i2, range='1d') {
  const c1 = document.getElementById('batteryChart');
  const c2 = document.getElementById('currentChart');
  const ctx1 = setupHiDPICanvas(c1);
  const ctx2 = setupHiDPICanvas(c2);
  if (!ctx1 || !ctx2) return;

  if (batteryChartInstance) batteryChartInstance.destroy();
  if (currentChartInstance) currentChartInstance.destroy();

  batteryChartInstance = new Chart(ctx1, {
    type:'line',
    data:{ datasets:[
      { label:'V Node1', data:v1, borderColor:'#ffd54f', backgroundColor:'rgba(255,213,79,0.2)', fill:true, tension:0.3, pointRadius:(v1.length===1?3:0) },
      { label:'V Node2', data:v2, borderColor:'#ffb74d', backgroundColor:'rgba(255,183,77,0.2)', fill:true, tension:0.3, pointRadius:(v2.length===1?3:0) },
    ]},
    options:{ parsing:false, scales:{ x:xScaleOpts(range), y:{ ticks:{color:'white'}, grid:{color:'rgba(255,255,255,0.12)'}, title:{display:true,text:'Battery (V)',color:'white'} } },
      plugins:{ legend:{labels:{color:'white'}} }, responsive:true, maintainAspectRatio:false }
  });

  currentChartInstance = new Chart(ctx2, {
    type:'line',
    data:{ datasets:[
      { label:'I Node1', data:i1, borderColor:'#a5d6a7', backgroundColor:'rgba(165,214,167,0.2)', fill:true, tension:0.3, pointRadius:(i1.length===1?3:0) },
      { label:'I Node2', data:i2, borderColor:'#81c784', backgroundColor:'rgba(129,199,132,0.2)', fill:true, tension:0.3, pointRadius:(i2.length===1?3:0) },
    ]},
    options:{ parsing:false, scales:{ x:xScaleOpts(range), y:{ ticks:{color:'white'}, grid:{color:'rgba(255,255,255,0.12)'}, title:{display:true,text:'Current (A)',color:'white'} } },
      plugins:{ legend:{labels:{color:'white'}} }, responsive:true, maintainAspectRatio:false }
  });
}

/* ---------- ปุ่มช่วงเวลา (3 กลุ่ม) ---------- */
function wireRangeGroup(selector, onRange){
  const wrap = document.querySelector(selector);
  if (!wrap) return;
  wrap.querySelectorAll('.range-btn').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      wrap.querySelectorAll('.range-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      await onRange(btn.dataset.range);
    });
  });
}
function setupAllRangeButtons() {
  wireRangeGroup('#timeRangeButtons', async (range) => {
    const rows = await fetchHistoricalData(range);
    const { water, v1, v2, i1, i2 } = parseChartData(rows);
    createWaterLevelChart(range, water);
    // อัปเดตกราฟแบต/กระแสพร้อมกัน (ถ้าอยากแยก ให้ย้ายไปกลุ่มปุ่มของมันเอง)
    createBatteryCurrentCharts(v1, v2, i1, i2, range);
  });
  wireRangeGroup('#batteryTimeRangeButtons', async (range) => {
    const rows = await fetchHistoricalData(range);
    const { v1, v2, i1, i2 } = parseChartData(rows);
    createBatteryCurrentCharts(v1, v2, i1, i2, range);
  });
  wireRangeGroup('#currentTimeRangeButtons', async (range) => {
    const rows = await fetchHistoricalData(range);
    const { v1, v2, i1, i2 } = parseChartData(rows);
    createBatteryCurrentCharts(v1, v2, i1, i2, range);
  });
}

/* ---------- โหลดครั้งแรก + รีเฟรช ---------- */
async function firstDraw() {
  // เริ่มจาก 1 วัน ตามปุ่ม active ใน HTML
  const rows = await fetchHistoricalData('1d');
  const { water, v1, v2, i1, i2 } = parseChartData(rows);
  createWaterLevelChart('1d', water);
  createBatteryCurrentCharts(v1, v2, i1, i2, '1d');
  await createOneHourChart();
}

window.onload = async () => {
  try { await firstDraw(); } catch(e){ console.error(e); }
  setupAllRangeButtons();
  // รีเฟรชข้อมูลทุก 60 วินาที
  setInterval(() => { firstDraw(); }, 60000);
};
