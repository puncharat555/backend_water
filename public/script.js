const fixedDepth = 120;
let allData = [];
let currentIndex = 0;
const pageSize = 10;

let waterLevelChartInstance = null;

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

    const ctx = document.getElementById('waterLevelChart30d').getContext('2d');

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
        maintainAspectRatio: true,
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

    const ctx1h = document.getElementById('waterLevelChart1h').getContext('2d');
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

    const ctxBattery = document.getElementById('batteryChart').getContext('2d');
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

async function createCurrentChart() {
  try {
    const data = await fetchHistoricalData('30d');
    const parsed = parseChartData(data);
    parsed.labels.reverse();
    parsed.currentsNode1.reverse();
    parsed.currentsNode2.reverse();

    const ctxCurrent = document.getElementById('currentChart').getContext('2d');
    new Chart(ctxCurrent, {
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
            label: 'กระแส Node 2 (mA)',
            data: parsed.currentsNode2,
            borderColor: '#1e90ff',
            backgroundColor: 'rgba(30,144,255,0.2)',
            fill: true,
            tension: 0.3,
            pointRadius: ctx => ctx.dataIndex === ctx.dataset.data.length - 1 ? 6 : 0,
            pointBackgroundColor: '#1e90ff',
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
            title: { display: true, text: 'กระแส (mA)', color: 'white' }
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

  const errorItems = data.filter(item => {
    return (
      !item.distance || item.distance <= 0 || item.distance > fixedDepth ||
      !item.rssi_node1 || item.rssi_node1 === 0 ||
      !item.rssi_node2 || item.rssi_node2 === 0 ||
      !item.v_node1 || item.v_node1 <= 0 ||
      !item.v_node2 || item.v_node2 <= 0 ||
      !item.i_node1 || item.i_node1 <= 0 ||
      !item.i_node2 || item.i_node2 <= 0 ||
      !item.time_node1 ||
      !item.time_node2
    );
  });

  if (errorItems.length === 0) {
    errorList.innerHTML = '<li>ไม่มีข้อมูลผิดปกติ</li>';
  } else {
    errorList.innerHTML = '';
    errorItems.forEach(item => {
      const errors = [];

      if (!item.distance || item.distance <= 0 || item.distance > fixedDepth) {
        errors.push(`ระดับน้ำดิบผิดปกติ: ${item.distance}`);
      }
      if (!item.rssi_node1 || item.rssi_node1 === 0) {
        errors.push(`RSSI Node1 ผิดปกติ: ${item.rssi_node1}`);
      }
      if (!item.rssi_node2 || item.rssi_node2 === 0) {
        errors.push(`RSSI Node2 ผิดปกติ: ${item.rssi_node2}`);
      }
      if (!item.v_node1 || item.v_node1 <= 0) {
        errors.push(`แรงดัน Node1 ผิดปกติ: ${item.v_node1}`);
      }
      if (!item.v_node2 || item.v_node2 <= 0) {
        errors.push(`แรงดัน Node2 ผิดปกติ: ${item.v_node2}`);
      }
      if (!item.i_node1 || item.i_node1 <= 0) {
        errors.push(`กระแส Node1 ผิดปกติ: ${item.i_node1}`);
      }
      if (!item.i_node2 || item.i_node2 <= 0) {
        errors.push(`กระแส Node2 ผิดปกติ: ${item.i_node2}`);
      }
      if (!item.time_node1) {
        errors.push(`เวลาวัด Node1 ผิดปกติ`);
      }
      if (!item.time_node2) {
        errors.push(`เวลาวัด Node2 ผิดปกติ`);
      }

      const li = document.createElement('li');
      li.innerText = `เวลา: ${item.time_node1 || item.time_node2 || '-'} — ${errors.join(', ')}`;
      errorList.appendChild(li);
    });
  }
}

function createCharts() {
  createWaterLevelChart('30d');
  createOneHourChart();
  createBatteryChart();
  createCurrentChart();
}

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  createCharts();

  setInterval(() => {
    loadData();
    createCharts();
  }, 300000);

  // ปุ่มเลือกช่วงเวลาในกราฟระดับน้ำย้อนหลัง
  const buttons = document.querySelectorAll('#timeRangeButtons .range-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      buttons.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');

      const range = e.target.getAttribute('data-range');
      createWaterLevelChart(range);
    });
  });
});

// ฟังก์ชัน toggle error box ให้ปุ่มเรียกใช้ได้
window.toggleErrorBox = toggleErrorBox;
