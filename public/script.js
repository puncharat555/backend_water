/* === Water Dashboard (time-scale + banded grid) === */
const fixedDepth = 120;
let allData = [];
let currentIndex = 0;
const pageSize = 10;

let waterLevelChartInstance = null;
let currentChartInstance = null;
let batteryChartInstance = null;
let oneHourChartInstance = null;

/* HiDPI canvas */
function setupHiDPICanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);
}

/* === Plugin: แถบพื้นหลังสลับสีตามช่องเวลา === */
const bandedBackground = {
  id: 'bandedBackground',
  beforeDraw(chart, args, opts) {
    if (!opts?.enabled) return;
    const { ctx, chartArea, scales } = chart;
    const x = scales.x;
    if (!x?.ticks?.length) return;
    ctx.save();
    const alpha = opts.opacity ?? 0.07;
    for (let i = 0; i < x.ticks.length - 1; i++) {
      if (i % 2 === 0) continue; // วาดสลับช่อง
      const x1 = x.getPixelForTick(i);
      const x2 = x.getPixelForTick(i + 1);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(x1, chartArea.top, x2 - x1, chartArea.bottom - chartArea.top);
    }
    ctx.restore();
  }
};
Chart.register(bandedBackground);

/* helper: แปลง timestamp "YYYY-MM-DD HH:MM:SS" -> Date */
function toISO(ts) { return ts ? ts.replace(' ', 'T') : null; }

/* โหลดข้อมูลปัจจุบัน */
async function loadData() {
  try {
    const url = `https://backend-water-rf88.onrender.com/distance?_=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    allData = data.filter(item => item.distance > 0);
    currentIndex = 0;

    updateTable(true);
    updateErrorList(data);

    const latest = allData[0];
    if (latest) {
      const level = (fixedDepth - latest.distance).toFixed(1);
      document.getElementById('waterLevelNode1').innerText = `ระดับน้ำปัจจุบัน: ${level} cm`;
      document.getElementById('rssiNode1').innerText  = (latest.rssi_node1 && latest.rssi_node1 !== 0) ? `RSSI: ${latest.rssi_node1}` : 'RSSI: -';
      document.getElementById('voltageNode1').innerText= (latest.v_node1 && latest.v_node1 > 0) ? `แรงดัน: ${latest.v_node1} V` : 'แรงดัน: -';
      document.getElementById('currentNode1').innerText= (latest.i_node1 && latest.i_node1 > 0) ? `กระแส: ${latest.i_node1} mA` : 'กระแส: -';
      document.getElementById('timeNode1').innerText   = latest.time_node1 || 'เวลาวัด: -';

      document.getElementById('rssiNode2').innerText  = (latest.rssi_node2 && latest.rssi_node2 !== 0) ? `RSSI: ${latest.rssi_node2}` : 'RSSI: -';
      document.getElementById('voltageNode2').innerText= (latest.v_node2 && latest.v_node2 > 0) ? `แรงดัน: ${latest.v_node2} V` : 'แรงดัน: -';
      document.getElementById('currentNode2').innerText= (latest.i_node2 && latest.i_node2 > 0) ? `กระแส: ${latest.i_node2} mA` : 'กระแส: -';
      document.getElementById('timeNode2').innerText   = latest.time_node2 || 'เวลาวัด: -';
    }
  } catch (error) {
    console.error('Load data error:', error);
    ['waterLevelNode1','rssiNode1','voltageNode1','currentNode1','timeNode1','rssiNode2','voltageNode2','currentNode2','timeNode2']
      .forEach(id => { const el = document.getElementById(id); if (el) el.innerText = '-'; });
    const waterLevelEl = document.getElementById('waterLevelNode1');
    if (waterLevelEl) waterLevelEl.innerText = 'โหลดข้อมูลล้มเหลว';
    const tbody = document.querySelector('#dataTable tbody');
    if (tbody) tbody.innerHTML = '';
    const more = document.getElementById('moreButtonContainer');
    if (more) more.innerHTML = '';
  }
}

function updateTable(clear = false) {
  const tbody = document.querySelector('#dataTable tbody');
  if (!tbody) return;
  if (clear) { tbody.innerHTML = ''; currentIndex = 0; }
  const sliceData = allData.slice(currentIndex, currentIndex + pageSize);

  sliceData.forEach(item => {
    const level = (fixedDepth - item.distance).toFixed(1);
    const distanceRaw = item.distance.toFixed(1);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${distanceRaw}</td><td>${level}</td>
      <td>${(item.rssi_node1 && item.rssi_node1 !== 0) ? item.rssi_node1 : '-'}</td>
      <td>${(item.rssi_node2 && item.rssi_node2 !== 0) ? item.rssi_node2 : '-'}</td>
      <td>${(item.v_node1 && item.v_node1 > 0) ? item.v_node1 + ' V' : '-'}</td>
      <td>${(item.i_node1 && item.i_node1 > 0) ? item.i_node1 + ' mA' : '-'}</td>
      <td>${(item.v_node2 && item.v_node2 > 0) ? item.v_node2 + ' V' : '-'}</td>
      <td>${(item.i_node2 && item.i_node2 > 0) ? item.i_node2 + ' mA' : '-'}</td>
      <td>${item.time_node1 || '-'}</td>
      <td>${item.time_node2 || '-'}</td>`;
    tbody.appendChild(tr);
  });

  currentIndex += sliceData.length;
  updateMoreButton();
}

function updateMoreButton() {
  const c = document.getElementById('moreButtonContainer');
  if (!c) return;
  c.innerHTML = '';
  if (currentIndex < allData.length) {
    const btn = document.createElement('button');
    btn.innerText = 'ดูข้อมูลเพิ่มเติม';
    btn.style.padding = '8px 16px';
    btn.style.margin = '10px auto';
    btn.style.display = 'inline-block';
    btn.style.cursor = 'pointer';
    btn.onclick = () => updateTable(false);
    c.appendChild(btn);
  }
}

/* ดึงข้อมูลย้อนหลัง */
async function fetchHistoricalData(range = '30d') {
  const url = `https://backend-water-rf88.onrender.com/distance?range=${range}&_=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  return data.filter(item => item.distance > 0);
}

/* parse เป็น Date + ชุดข้อมูลต่าง ๆ */
function parseChartData(data) {
  const labels = [];
  const waterLevels = [];
  const voltagesNode1 = [];
  const voltagesNode2 = [];
  const currentsNode1 = [];
  const currentsNode2 = [];

  data.forEach(item => {
    const iso = toISO(item.time_node1 || item.time_node2 || '');
    labels.push(iso ? new Date(iso) : null);

    const level = (item.distance && item.distance > 0) ? Number((fixedDepth - item.distance).toFixed(2)) : NaN;
    waterLevels.push(level);

    voltagesNode1.push(item.v_node1 > 0 ? item.v_node1 : NaN);
    voltagesNode2.push(item.v_node2 > 0 ? item.v_node2 : NaN);
    currentsNode1.push(item.i_node1 > 0 ? item.i_node1 : NaN);
    currentsNode2.push(item.i_node2 > 0 ? item.i_node2 : NaN);
  });

  return { labels, waterLevels, voltagesNode1, voltagesNode2, currentsNode1, currentsNode2 };
}

/* ตัวช่วยตั้งค่าแกนเวลา */
const unitByRange = r => (r === '1h' ? 'minute' : r === '1d' ? 'hour' : 'day');
const stepByRange = r => (r === '1h' ? 10 : 1);  // 1h = ทุก 10 นาที
function xScaleOpts(range) {
  return {
    type: 'time',
    time: {
      unit: unitByRange(range),
      stepSize: stepByRange(range),
      displayFormats: { minute: 'HH:mm', hour: 'HH:mm', day: 'MMM d' }
    },
    ticks: {
      color: 'white',
      autoSkip: true, maxRotation: 0, padding: 6, autoSkipPadding: 18
    },
    grid: {
      display: true, color: 'rgba(255,255,255,0.22)', lineWidth: 1, drawTicks: true
    }
  };
}

/* === Charts === */
async function createWaterLevelChart(range = '1d') {
  try {
    const data = await fetchHistoricalData(range);
    const parsed = parseChartData(data);
    parsed.labels.reverse(); parsed.waterLevels.reverse();

    const canvas = document.getElementById('waterLevelChart30d');
    setupHiDPICanvas(canvas);
    const ctx = canvas.getContext('2d');
    if (waterLevelChartInstance) waterLevelChartInstance.destroy();

    waterLevelChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: parsed.labels,
        datasets: [{
          label: `ระดับน้ำย้อนหลัง ${range}`,
          data: parsed.waterLevels,
          borderColor: '#00c0ff',
          backgroundColor: 'rgba(0,192,255,0.2)',
          fill: true, tension: 0.3,
          pointRadius: i => i.dataIndex === i.dataset.data.length - 1 ? 6 : 0,
          pointBackgroundColor: '#00c0ff',
        }],
      },
      options: {
        spanGaps: true,
        scales: { x: xScaleOpts(range), y: {
          beginAtZero: true,
          title: { display: true, text: 'ระดับน้ำ (cm)', color: 'white' },
          ticks: { color: 'white' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        }},
        plugins: {
          legend: { labels: { color: 'white' } },
          tooltip: { mode: 'index', intersect: false },
          bandedBackground: { enabled: true, opacity: 0.07 }
        },
        responsive: true, maintainAspectRatio: false,
      }
    });
  } catch (err) { console.error('Error creating water level chart:', err); }
}

async function createOneHourChart() {
  try {
    const data = await fetchHistoricalData('1h');
    const parsed = parseChartData(data);
    parsed.labels.reverse(); parsed.waterLevels.reverse();

    const canvas1h = document.getElementById('waterLevelChart1h');
    setupHiDPICanvas(canvas1h);
    const ctx1h = canvas1h.getContext('2d');
    if (oneHourChartInstance) oneHourChartInstance.destroy();

    oneHourChartInstance = new Chart(ctx1h, {
      type: 'line',
      data: { labels: parsed.labels, datasets: [{
        label: 'ระดับน้ำ (cm) 1 ชั่วโมง',
        data: parsed.waterLevels,
        borderColor: '#0f0',
        backgroundColor: 'rgba(29, 233, 29, 0.2)',
        fill: true, tension: 0.3, pointRadius: 0
      }]},
      options: {
        spanGaps: true,
        scales: { x: xScaleOpts('1h'), y: { beginAtZero: true, ticks: { color: 'white' } } },
        plugins: {
          legend: { labels: { color: 'white' } },
          tooltip: { mode: 'index', intersect: false },
          bandedBackground: { enabled: true, opacity: 0.07 }
        },
        responsive: true, maintainAspectRatio: false,
      }
    });
  } catch (err) { console.error('Error creating 1h chart:', err); }
}

async function createBatteryChart(range = '1d') {
  try {
    const data = await fetchHistoricalData(range);
    const parsed = parseChartData(data);
    parsed.labels.reverse(); parsed.voltagesNode1.reverse(); parsed.voltagesNode2.reverse();

    const canvas = document.getElementById('batteryChart');
    setupHiDPICanvas(canvas);
    const ctx = canvas.getContext('2d');
    if (batteryChartInstance) batteryChartInstance.destroy();

    batteryChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: parsed.labels,
        datasets: [
          { label: 'แรงดัน Node 1 (V)', data: parsed.voltagesNode1,
            borderColor: '#ff7f00', backgroundColor: 'rgba(255,127,0,0.2)',
            fill: true, tension: 0.3, pointRadius: 0 },
          { label: 'แรงดัน Node 2 (V)', data: parsed.voltagesNode2,
            borderColor: '#007fff', backgroundColor: 'rgba(0,127,255,0.2)',
            fill: true, tension: 0.3, pointRadius: 0 }
        ],
      },
      options: {
        spanGaps: true,
        scales: { x: xScaleOpts(range), y: {
          beginAtZero: false, ticks: { color: 'white' },
          title: { display: true, text: 'แรงดัน (V)', color: 'white' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        }},
        plugins: {
          legend: { labels: { color: 'white' } },
          tooltip: { mode: 'index', intersect: false },
          bandedBackground: { enabled: true, opacity: 0.07 }
        },
        responsive: true, maintainAspectRatio: false,
      }
    });
  } catch (err) { console.error('Error creating battery chart:', err); }
}

function movingAverage(data, windowSize) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const windowData = data.slice(start, i + 1).filter(v => !isNaN(v));
    const avg = windowData.reduce((a, b) => a + b, 0) / (windowData.length || 1);
    result.push(avg);
  }
  return result;
}

async function createCurrentChart(range = '1d') {
  try {
    const data = await fetchHistoricalData(range);
    let parsed = parseChartData(data);
    parsed.labels.reverse(); parsed.currentsNode1.reverse(); parsed.currentsNode2.reverse();

    // กรองจุดที่มี 2 โหนดพร้อมกัน
    (function filterValidPoints() {
      const L = []; const A = []; const B = [];
      for (let i = 0; i < parsed.labels.length; i++) {
        if (!isNaN(parsed.currentsNode1[i]) && !isNaN(parsed.currentsNode2[i])) {
          L.push(parsed.labels[i]); A.push(parsed.currentsNode1[i]); B.push(parsed.currentsNode2[i]);
        }
      }
      parsed.labels = L; parsed.currentsNode1 = A; parsed.currentsNode2 = B;
    })();

    const canvas = document.getElementById('currentChart');
    setupHiDPICanvas(canvas);
    const ctx = canvas.getContext('2d');
    if (currentChartInstance) currentChartInstance.destroy();

    currentChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: parsed.labels,
        datasets: [
          { label: 'กระแส Node 1 (mA)', data: parsed.currentsNode1,
            borderColor: '#ff4500', backgroundColor: 'rgba(255,69,0,0.2)',
            fill: true, tension: 0.3, pointRadius: 0 },
          { label: 'กระแส Node 2 (mA)', data: parsed.currentsNode2,
            borderColor: '#1e90ff', backgroundColor: 'rgba(30,144,255,0.2)',
            fill: true, tension: 0.3, pointRadius: 0 },
        ],
      },
      options: {
        spanGaps: true,
        scales: { x: xScaleOpts(range), y: {
          beginAtZero: false, ticks: { color: 'white' },
          title: { display: true, text: 'กระแส (mA)', color: 'white' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        }},
        plugins: {
          legend: { labels: { color: 'white' } },
          tooltip: { mode: 'index', intersect: false },
          bandedBackground: { enabled: true, opacity: 0.07 }
        },
        responsive: true, maintainAspectRatio: false,
      }
    });
  } catch (err) { console.error('Error creating current chart:', err); }
}

/* UI อื่น ๆ */
function toggleErrorBox() {
  const box = document.getElementById('errorBox');
  if (!box) return;
  box.style.display = (box.style.display === 'none' || box.style.display === '') ? 'block' : 'none';
}

function updateErrorList(data) {
  const box = document.getElementById('errorList');
  if (!box) return;
  box.innerHTML = '';
  data.forEach(item => {
    if (item.distance < 10) {
      const div = document.createElement('div');
      div.innerText = `Warning! ระดับน้ำต่ำเกินไป: ${item.distance.toFixed(1)} cm เวลา: ${item.time_node1}`;
      box.appendChild(div);
    }
  });
}

/* เริ่มต้น: ทุกกราฟ = 1 วัน */
async function initDashboard() {
  await loadData();
  await createWaterLevelChart('1d');
  await createOneHourChart();     // กราฟ 1 ชั่วโมง
  await createBatteryChart('1d'); // เริ่มที่ 1 วัน
  await createCurrentChart('1d'); // เริ่มที่ 1 วัน
}

function setupRangeButtons() {
  // ระดับน้ำ
  const waterBtns = document.querySelectorAll('#timeRangeButtons .range-btn');
  waterBtns.forEach(button => {
    button.addEventListener('click', async () => {
      waterBtns.forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      const range = button.getAttribute('data-range');
      if (range === '1h') await createOneHourChart();
      else await createWaterLevelChart(range);
      await createCurrentChart(range);
    });
  });

  // กระแส
  const currentBtns = document.querySelectorAll('#currentTimeRangeButtons .range-btn');
  currentBtns.forEach(button => {
    button.addEventListener('click', async () => {
      currentBtns.forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      const range = button.getAttribute('data-range');
      await createCurrentChart(range);
    });
  });

  // แบตเตอรี่
  const batteryBtns = document.querySelectorAll('#batteryTimeRangeButtons .range-btn');
  batteryBtns.forEach(button => {
    button.addEventListener('click', async () => {
      batteryBtns.forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      const range = button.getAttribute('data-range');
      await createBatteryChart(range);
    });
  });
}

/* boot */
window.onload = async () => {
  await initDashboard();
  setupRangeButtons();
};
setInterval(() => { loadData(); }, 60000);
