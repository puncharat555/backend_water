const fixedDepth = 120;
let allData = [];
let currentIndex = 0;
const pageSize = 10;

let waterLevelChartInstance = null;
let currentChartInstance = null;
let batteryChartInstance = null;
let oneHourChartInstance = null;

/* ========= Styling Helpers (Minimal, clean like reference image) ========= */
function makeGradients(ctx){
  const h = ctx.canvas.clientHeight || 300;
  const gBlue = ctx.createLinearGradient(0,0,0,h);
  gBlue.addColorStop(0,'rgba(0,122,255,0.30)');
  gBlue.addColorStop(1,'rgba(0,122,255,0.00)');

  const gPink = ctx.createLinearGradient(0,0,0,h);
  gPink.addColorStop(0,'rgba(255,99,132,0.30)');
  gPink.addColorStop(1,'rgba(255,99,132,0.00)');

  const gOrange = ctx.createLinearGradient(0,0,0,h);
  gOrange.addColorStop(0,'rgba(255,159,64,0.30)');
  gOrange.addColorStop(1,'rgba(255,159,64,0.00)');

  const gGreen = ctx.createLinearGradient(0,0,0,h);
  gGreen.addColorStop(0,'rgba(46,204,113,0.30)');
  gGreen.addColorStop(1,'rgba(46,204,113,0.00)');

  return { gBlue, gPink, gOrange, gGreen };
}

function baseLineOptions(yTitle){
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { left: 8, right: 8, top: 8, bottom: 8 } },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, color: '#cfd8e3', padding: 18 }
      },
      tooltip: {
        backgroundColor: 'rgba(255,255,255,0.95)',
        titleColor: '#111',
        bodyColor: '#333',
        borderColor: 'rgba(0,0,0,0.06)',
        borderWidth: 1,
        displayColors: false,
        padding: 10
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(0,0,0,0.06)', drawTicks: false },
        ticks:{ color:'#cfd8e3', maxRotation:0, autoSkip:true, maxTicksLimit:6 }
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.06)' },
        ticks:{ color:'#cfd8e3' },
        title: yTitle ? { display:true, text:yTitle, color:'#cfd8e3' } : undefined
      }
    },
    elements: {
      line: { tension: 0.4, borderWidth: 2 },
      point:{ radius: 2, hoverRadius: 5, hitRadius: 8 }
    },
    animation: { duration: 600 }
  };
}

/* ======================= Data Loading & Table ======================= */
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
      document.getElementById('rssiNode1').innerText = (latest.rssi_node1 && latest.rssi_node1 !== 0) ? `RSSI: ${latest.rssi_node1}` : 'RSSI: -';
      document.getElementById('voltageNode1').innerText = (latest.v_node1 && latest.v_node1 > 0) ? `แรงดัน: ${latest.v_node1} V` : 'แรงดัน: -';
      document.getElementById('currentNode1').innerText = (latest.i_node1 && latest.i_node1 > 0) ? `กระแส: ${latest.i_node1} mA` : 'กระแส: -';
      document.getElementById('timeNode1').innerText = latest.time_node1 || 'เวลาวัด: -';

      document.getElementById('rssiNode2').innerText = (latest.rssi_node2 && latest.rssi_node2 !== 0) ? `RSSI: ${latest.rssi_node2}` : 'RSSI: -';
      document.getElementById('voltageNode2').innerText = (latest.v_node2 && latest.v_node2 > 0) ? `แรงดัน: ${latest.v_node2} V` : 'แรงดัน: -';
      document.getElementById('currentNode2').innerText = (latest.i_node2 && latest.i_node2 > 0) ? `กระแส: ${latest.i_node2} mA` : 'กระแส: -';
      document.getElementById('timeNode2').innerText = latest.time_node2 || 'เวลาวัด: -';
    }

  } catch (error) {
    console.error('Load data error:', error);
    ['waterLevelNode1', 'rssiNode1', 'voltageNode1', 'currentNode1', 'timeNode1',
      'rssiNode2', 'voltageNode2', 'currentNode2', 'timeNode2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerText = '-';
    });
    const waterLevelEl = document.getElementById('waterLevelNode1');
    if (waterLevelEl) waterLevelEl.innerText = 'โหลดข้อมูลล้มเหลว';

    const tbody = document.querySelector('#dataTable tbody');
    if(tbody) tbody.innerHTML = '';
    const moreButtonContainer = document.getElementById('moreButtonContainer');
    if(moreButtonContainer) moreButtonContainer.innerHTML = '';
  }
}

function updateTable(clear = false) {
  const tbody = document.querySelector('#dataTable tbody');
  if (!tbody) return;

  if (clear) {
    tbody.innerHTML = '';
    currentIndex = 0;
  }

  const sliceData = allData.slice(currentIndex, currentIndex + pageSize);

  sliceData.forEach(item => {
    const level = (fixedDepth - item.distance).toFixed(1);
    const distanceRaw = item.distance.toFixed(1);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${distanceRaw}</td>
      <td>${level}</td>
      <td>${(item.rssi_node1 && item.rssi_node1 !== 0) ? item.rssi_node1 : '-'}</td>
      <td>${(item.rssi_node2 && item.rssi_node2 !== 0) ? item.rssi_node2 : '-'}</td>
      <td>${(item.v_node1 && item.v_node1 > 0) ? item.v_node1 + ' V' : '-'}</td>
      <td>${(item.i_node1 && item.i_node1 > 0) ? item.i_node1 + ' mA' : '-'}</td>
      <td>${(item.v_node2 && item.v_node2 > 0) ? item.v_node2 + ' V' : '-'}</td>
      <td>${(item.i_node2 && item.i_node2 > 0) ? item.i_node2 + ' mA' : '-'}</td>
      <td>${item.time_node1 || '-'}</td>
      <td>${item.time_node2 || '-'}</td>
    `;
    tbody.appendChild(tr);
  });

  currentIndex += sliceData.length;

  updateMoreButton();
}

function updateMoreButton() {
  const moreButtonContainer = document.getElementById('moreButtonContainer');
  if (!moreButtonContainer) return;

  moreButtonContainer.innerHTML = '';

  if (currentIndex < allData.length) {
    const btn = document.createElement('button');
    btn.innerText = 'ดูข้อมูลเพิ่มเติม';
    btn.style.padding = '8px 16px';
    btn.style.margin = '10px auto';
    btn.style.display = 'inline-block';
    btn.style.cursor = 'pointer';

    btn.onclick = () => {
      updateTable(false);
    };

    moreButtonContainer.appendChild(btn);
  }
}

/* ======================= Fetch & Parse Chart Data ======================= */
async function fetchHistoricalData(range = '30d') {
  const url = `https://backend-water-rf88.onrender.com/distance?range=${range}&_=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  return data.filter(item => item.distance > 0);
}

function parseChartData(data) {
  const labels = [];
  const waterLevels = [];
  const voltagesNode1 = [];
  const voltagesNode2 = [];
  const currentsNode1 = [];
  const currentsNode2 = [];

  data.forEach(item => {
    const timeLabel = item.time_node1 || item.time_node2 || '';
    labels.push(timeLabel);

    const level = (item.distance && item.distance > 0) ? Number((fixedDepth - item.distance).toFixed(2)) : NaN;
    waterLevels.push(level);

    voltagesNode1.push(item.v_node1 > 0 ? item.v_node1 : NaN);
    voltagesNode2.push(item.v_node2 > 0 ? item.v_node2 : NaN);

    currentsNode1.push(item.i_node1 > 0 ? item.i_node1 : NaN);
    currentsNode2.push(item.i_node2 > 0 ? item.i_node2 : NaN);
  });

  return { labels, waterLevels, voltagesNode1, voltagesNode2, currentsNode1, currentsNode2 };
}

/* ======================= Charts ======================= */
async function createWaterLevelChart(range = '30d') {
  try {
    const data = await fetchHistoricalData(range);
    const parsed = parseChartData(data);

    parsed.labels.reverse();
    parsed.waterLevels.reverse();

    const ctx = document.getElementById('waterLevelChart30d').getContext('2d');
    const { gBlue } = makeGradients(ctx);

    if (waterLevelChartInstance) waterLevelChartInstance.destroy();

    waterLevelChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: parsed.labels,
        datasets: [{
          label: `ระดับน้ำย้อนหลัง ${range}`,
          data: parsed.waterLevels,
          borderColor: '#007AFF',
          backgroundColor: gBlue,
          fill: true,
          spanGaps: true,
          pointRadius: (c) => c.dataIndex === c.dataset.data.length - 1 ? 5 : 2
        }]
      },
      options: baseLineOptions('ระดับน้ำ (cm)')
    });
  } catch (err) {
    console.error('Error creating water level chart:', err);
  }
}

async function createOneHourChart() {
  try {
    const data = await fetchHistoricalData('1h');
    const parsed = parseChartData(data);
    parsed.labels.reverse();
    parsed.waterLevels.reverse();

    const ctx = document.getElementById('waterLevelChart1h').getContext('2d');
    const { gGreen } = makeGradients(ctx);

    if (oneHourChartInstance) oneHourChartInstance.destroy();

    oneHourChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: parsed.labels,
        datasets: [{
          label: 'ระดับน้ำ (cm) 1 ชั่วโมง',
          data: parsed.waterLevels,
          borderColor: '#2ecc71',
          backgroundColor: gGreen,
          fill: true,
          spanGaps: true,
          pointRadius: (c) => c.dataIndex === c.dataset.data.length - 1 ? 5 : 2
        }]
      },
      options: baseLineOptions('ระดับน้ำ (cm)')
    });
  } catch (err) {
    console.error('Error creating 1h chart:', err);
  }
}

async function createBatteryChart() {
  try {
    const data = await fetchHistoricalData('30d');
    const parsed = parseChartData(data);
    parsed.labels.reverse();
    parsed.voltagesNode1.reverse();
    parsed.voltagesNode2.reverse();

    const ctx = document.getElementById('batteryChart').getContext('2d');
    const { gPink, gOrange } = makeGradients(ctx);

    if (batteryChartInstance) batteryChartInstance.destroy();

    batteryChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: parsed.labels,
        datasets: [
          {
            label: 'แรงดัน Node 1 (V)',
            data: parsed.voltagesNode1,
            borderColor: '#FF6384',
            backgroundColor: gPink,
            fill: true,
            spanGaps: true,
            pointRadius: (c) => c.dataIndex === c.dataset.data.length - 1 ? 5 : 2
          },
          {
            label: 'แรงดัน Node 2 (V)',
            data: parsed.voltagesNode2,
            borderColor: '#FF9F40',
            backgroundColor: gOrange,
            fill: true,
            spanGaps: true,
            pointRadius: (c) => c.dataIndex === c.dataset.data.length - 1 ? 5 : 2
          }
        ],
      },
      options: baseLineOptions('แรงดัน (V)')
    });
  } catch (err) {
    console.error('Error creating battery chart:', err);
  }
}

async function createCurrentChart(range = '30d') {
  try {
    const data = await fetchHistoricalData(range);
    let parsed = parseChartData(data);

    parsed.labels.reverse();
    parsed.currentsNode1.reverse();
    parsed.currentsNode2.reverse();

    // กรองเฉพาะจุดที่มีค่า N1 และ N2 ครบ
    const labels = [];
    const n1 = [];
    const n2 = [];
    for (let i = 0; i < parsed.labels.length; i++) {
      if (!isNaN(parsed.currentsNode1[i]) && !isNaN(parsed.currentsNode2[i])) {
        labels.push(parsed.labels[i]);
        n1.push(parsed.currentsNode1[i]);
        n2.push(parsed.currentsNode2[i]);
      }
    }

    const ctx = document.getElementById('currentChart').getContext('2d');
    const { gBlue, gPink } = makeGradients(ctx);

    if (currentChartInstance) currentChartInstance.destroy();

    currentChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'กระแส Node 1 (mA)',
            data: n1,
            borderColor: '#007AFF',
            backgroundColor: gBlue,
            fill: true,
            spanGaps: true,
            pointRadius: (c) => c.dataIndex === c.dataset.data.length - 1 ? 5 : 2
          },
          {
            label: 'กระแส Node 2 (mA)',
            data: n2,
            borderColor: '#FF6384',
            backgroundColor: gPink,
            fill: true,
            spanGaps: true,
            pointRadius: (c) => c.dataIndex === c.dataset.data.length - 1 ? 5 : 2
          },
        ],
      },
      options: baseLineOptions('กระแส (mA)')
    });
  } catch (err) {
    console.error('Error creating current chart:', err);
  }
}

/* ======================= Error Box ======================= */
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
      const li = document.createElement('li');
      li.innerText = `Warning! ระดับน้ำต่ำเกินไป: ${item.distance.toFixed(1)} cm เวลา: ${item.time_node1}`;
      box.appendChild(li);
    }
  });
}

/* ======================= Init & Buttons ======================= */
async function initDashboard() {
  await loadData();
  await createWaterLevelChart('30d');
  await createOneHourChart();
  await createBatteryChart();
  await createCurrentChart('30d');
}

function setupRangeButtons() {
  const waterLevelButtons = document.querySelectorAll('#timeRangeButtons .range-btn');
  waterLevelButtons.forEach(button => {
    button.addEventListener('click', async () => {
      waterLevelButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      const range = button.getAttribute('data-range');
      if (range === '1h') {
        await createOneHourChart();
      } else {
        await createWaterLevelChart(range);
      }
      await createCurrentChart(range);
    });
  });

  const currentButtons = document.querySelectorAll('#currentTimeRangeButtons .range-btn');
  currentButtons.forEach(button => {
    button.addEventListener('click', async () => {
      currentButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      const range = button.getAttribute('data-range');
      await createCurrentChart(range);
    });
  });
}

window.onload = async () => {
  await initDashboard();
  setupRangeButtons();
};
setInterval(() => {
  loadData();
}, 60000);
