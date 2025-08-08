const fixedDepth = 120;
let allData = [];
let currentIndex = 0;
const pageSize = 10;

let waterLevelChartInstance = null;
let currentChartInstance = null;

function setupHiDPICanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);
}

// โหลดข้อมูลปัจจุบันแสดงใน node และตาราง
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
      document.getElementById('waterLevelNode1').innerText = `ระดับน้ำ: ${level} cm`;
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

async function createWaterLevelChart(range = '30d') {
  try {
    const data = await fetchHistoricalData(range);
    const parsed = parseChartData(data);

    parsed.labels.reverse();
    parsed.waterLevels.reverse();

    const canvas = document.getElementById('waterLevelChart30d');
    setupHiDPICanvas(canvas);
    const ctx = canvas.getContext('2d');

    if (waterLevelChartInstance) {
      waterLevelChartInstance.destroy();
    }

    waterLevelChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: parsed.labels,
        datasets: [{
          label: `ระดับน้ำย้อนหลัง ${range}`,
          data: parsed.waterLevels,
          borderColor: '#00c0ff',
          backgroundColor: 'rgba(0,192,255,0.2)',
          fill: true,
          tension: 0.3,
          pointRadius: ctx => ctx.dataIndex === ctx.dataset.data.length - 1 ? 6 : 0,
          pointBackgroundColor: '#00c0ff',
        }],
      },
      options: {
        spanGaps: true,
        scales: {
          x: { ticks: { display: false }, grid: { drawTicks: false } },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'ระดับน้ำ (cm)', color: 'white' },
            ticks: { color: 'white' }
          }
        },
        plugins: {
          legend: { labels: { color: 'white' } },
          tooltip: { mode: 'index', intersect: false }
        },
        responsive: true,
        maintainAspectRatio: false,
      }
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

    const canvas1h = document.getElementById('waterLevelChart1h');
    setupHiDPICanvas(canvas1h);
    const ctx1h = canvas1h.getContext('2d');

    new Chart(ctx1h, {
      type: 'line',
      data: {
        labels: parsed.labels,
        datasets: [{
          label: 'ระดับน้ำ (cm) 1 ชั่วโมง',
          data: parsed.waterLevels,
          borderColor: '#0f0',
          backgroundColor: 'rgba(29, 233, 29, 0.2)',
          fill: true,
          tension: 0.3,
          pointRadius: ctx => ctx.dataIndex === ctx.dataset.data.length - 1 ? 6 : 0,
          pointBackgroundColor: 'rgba(29, 241, 29, 0.83)',
        }],
      },
      options: {
        spanGaps: true,
        scales: {
          x: { ticks: { display: false }, grid: { drawTicks: false } },
          y: { beginAtZero: true, ticks: { color: 'white' } }
        },
        plugins: {
          legend: { labels: { color: 'white' } },
          tooltip: { mode: 'index', intersect: false }
        },
        responsive: true,
        maintainAspectRatio: false,
      }
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

    const canvasBattery = document.getElementById('batteryChart');
    setupHiDPICanvas(canvasBattery);
    const ctxBattery = canvasBattery.getContext('2d');

    new Chart(ctxBattery, {
      type: 'line',
      data: {
        labels: parsed.labels,
        datasets: [
          {
            label: 'แรงดัน Node 1 (V)',
            data: parsed.voltagesNode1,
            borderColor: '#ff7f00',
            backgroundColor: 'rgba(255,127,0,0.2)',
            fill: true,
            tension: 0.3,
            pointRadius: ctx => ctx.dataIndex === ctx.dataset.data.length - 1 ? 6 : 0,
            pointBackgroundColor: '#ff7f00',
          },
          {
            label: 'แรงดัน Node 2 (V)',
            data: parsed.voltagesNode2,
            borderColor: '#007fff',
            backgroundColor: 'rgba(0,127,255,0.2)',
            fill: true,
            tension: 0.3,
            pointRadius: ctx => ctx.dataIndex === ctx.dataset.data.length - 1 ? 6 : 0,
            pointBackgroundColor: '#007fff',
          }
        ],
      },
      options: {
        spanGaps: true,
        scales: {
          x: { ticks: { display: false }, grid: { drawTicks: false } },
          y: {
            beginAtZero: false,
            ticks: { color: 'white' },
            title: { display: true, text: 'แรงดัน (V)', color: 'white' }
          }
        },
        plugins: {
          legend: { labels: { color: 'white' } },
          tooltip: { mode: 'index', intersect: false }
        },
        responsive: true,
        maintainAspectRatio: false,
      }
    });
  } catch (err) {
    console.error('Error creating battery chart:', err);
  }
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

async function createCurrentChart(range = '30d') {
  try {
    const data = await fetchHistoricalData(range);
    let parsed = parseChartData(data);

    // reverse data for chronological order
    parsed.labels.reverse();
    parsed.currentsNode1.reverse();
    parsed.currentsNode2.reverse();

    // กรองข้อมูลที่เป็น NaN ออกให้หมดทั้งสอง Node (ข้อมูลต้องครบทั้งสองฝั่ง)
    function filterValidPoints(labels, data1, data2) {
      const filteredLabels = [];
      const filteredData1 = [];
      const filteredData2 = [];
      for (let i = 0; i < labels.length; i++) {
        if (!isNaN(data1[i]) && !isNaN(data2[i])) {
          filteredLabels.push(labels[i]);
          filteredData1.push(data1[i]);
          filteredData2.push(data2[i]);
        }
      }
      return {
        labels: filteredLabels,
        currentsNode1: filteredData1,
        currentsNode2: filteredData2,
      };
    }

    parsed = filterValidPoints(parsed.labels, parsed.currentsNode1, parsed.currentsNode2);

    const maCurrentsNode1 = movingAverage(parsed.currentsNode1, 5);
    const maCurrentsNode2 = movingAverage(parsed.currentsNode2, 5);

    const currentThreshold = 500;
    const thresholdArray = new Array(parsed.currentsNode1.length).fill(currentThreshold);

    const canvasCurrent = document.getElementById('currentChart');
    setupHiDPICanvas(canvasCurrent);
    const ctxCurrent = canvasCurrent.getContext('2d');

    if (currentChartInstance) {
      currentChartInstance.destroy();
    }

    currentChartInstance = new Chart(ctxCurrent, {
      type: 'line',
      data: {
        labels: parsed.labels,
        datasets: [
          {
            label: 'กระแส Node 1 (mA)',
            data: parsed.currentsNode1,
            borderColor: '#ff4500',
            backgroundColor: 'rgba(255,69,0,0.2)',
            fill: true,
            tension: 0.3,
            pointRadius: ctx => ctx.dataIndex === ctx.dataset.data.length - 1 ? 6 : 0,
            pointBackgroundColor: '#ff4500',
          },
          {
            label: 'MA กระแส Node 1',
            data: maCurrentsNode1,
            borderColor: '#ff8c00',
            backgroundColor: 'rgba(255,140,0,0.1)',
            fill: false,
            borderDash: [5,5],
            tension: 0.3,
            pointRadius: 0,
          },
          {
            label: 'กระแส Node 2 (mA)',
            data: parsed.currentsNode2,
            borderColor: '#1e90ff',
            backgroundColor: 'rgba(30,144,255,0.2)',
            fill: true,
            tension: 0.3,
            pointRadius: ctx => ctx.dataIndex === ctx.dataset.data.length - 1 ? 6 : 0,
            pointBackgroundColor: '#1e90ff',
          },
          {
            label: 'MA กระแส Node 2',
            data: maCurrentsNode2,
            borderColor: '#00bfff',
            backgroundColor: 'rgba(0,191,255,0.1)',
            fill: false,
            borderDash: [5,5],
            tension: 0.3,
            pointRadius: 0,
          },
          {
            label: 'เส้นไฟ (Threshold) 500 mA',
            data: thresholdArray,
            borderColor: '#ff0000',
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            borderDash: [10, 5],
          },
        ],
      },
      options: {
        spanGaps: true,
        scales: {
          x: {
            ticks: { display: false, color: 'white' },
            grid: { drawTicks: false, color: 'rgba(255,255,255,0.1)' }
          },
          y: {
            beginAtZero: false,
            ticks: { color: 'white' },
            title: { display: true, text: 'กระแส (mA)', color: 'white' },
            grid: { color: 'rgba(255,255,255,0.1)' }
          }
        },
        plugins: {
          legend: { labels: { color: 'white' } },
          tooltip: { mode: 'index', intersect: false }
        },
        responsive: true,
        maintainAspectRatio: false,
      }
    });
  } catch (err) {
    console.error('Error creating current chart:', err);
  }
}

function toggleErrorBox() {
  const errorBox = document.getElementById('errorBox');
  if (!errorBox) return;
  errorBox.classList.toggle('hidden');
}

function updateErrorList(data) {
  const errorList = document.getElementById('errorList');
  if (!errorList) return;
  errorList.innerHTML = '';

  data.forEach(item => {
    if (item.distance === 0) {
      const li = document.createElement('li');
      li.textContent = `พบข้อมูลระยะ 0 cm ที่เวลา node1: ${item.time_node1 || '-'}, node2: ${item.time_node2 || '-'}`;
      errorList.appendChild(li);
    }
  });

  if (errorList.children.length > 0) {
    const errorBox = document.getElementById('errorBox');
    if(errorBox) errorBox.classList.remove('hidden');
  }
}

async function refreshAll() {
  await loadData();
  await createWaterLevelChart('30d');
  await createOneHourChart();
  await createBatteryChart();
  await createCurrentChart('30d');
}

document.addEventListener('DOMContentLoaded', () => {
  refreshAll();
  setInterval(refreshAll, 60000); // refresh ทุก 60 วินาที

  const errorToggleBtn = document.getElementById('errorToggleBtn');
  if (errorToggleBtn) {
    errorToggleBtn.addEventListener('click', toggleErrorBox);
  }
});
