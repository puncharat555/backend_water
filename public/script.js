const fixedDepth = 120;
let allData = [];      
let currentIndex = 0;  
const pageSize = 10;   

// โหลดข้อมูลปัจจุบันแสดงใน node และตาราง
async function loadData() {
  try {
    const url = `https://backend-water-rf88.onrender.com/distance?_=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    // กรองข้อมูลที่มี distance > 0
    allData = data.filter(item => item.distance > 0);
    currentIndex = 0;  // เริ่มแสดงหน้าแรก

    updateTable(true);  // clear = true เพื่อเคลียร์ตารางก่อนเพิ่มข้อมูลใหม่
    updateErrorList(data);

    // แสดงข้อมูลปัจจุบัน (latest)
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
    // กรณี error ให้เคลียร์ข้อมูลบนหน้า
    ['waterLevelNode1', 'rssiNode1', 'voltageNode1', 'currentNode1', 'timeNode1',
     'rssiNode2', 'voltageNode2', 'currentNode2', 'timeNode2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerText = '-';
    });
    const waterLevelEl = document.getElementById('waterLevelNode1');
    if (waterLevelEl) waterLevelEl.innerText = 'โหลดข้อมูลล้มเหลว';

    // เคลียร์ตารางและปุ่มเพิ่มเติมด้วย
    const tbody = document.querySelector('#dataTable tbody');
    if(tbody) tbody.innerHTML = '';
    const moreButtonContainer = document.getElementById('moreButtonContainer');
    if(moreButtonContainer) moreButtonContainer.innerHTML = '';
  }
}

// อัพเดทตารางข้อมูล
// clear=true จะเคลียร์ตารางก่อนเพิ่มข้อมูลใหม่ (ใช้ตอนโหลดข้อมูลชุดใหม่)
// clear=false จะเพิ่มข้อมูลต่อท้าย (ใช้ตอนกดดูข้อมูลเพิ่มเติม)
function updateTable(clear = false) {
  const tbody = document.querySelector('#dataTable tbody');
  if (!tbody) return;

  if (clear) {
    tbody.innerHTML = '';   // เคลียร์ข้อมูลเก่า
    currentIndex = 0;       // เริ่มแสดงแถวแรกใหม่
  }

  // ตัดข้อมูลช่วงที่จะแสดง
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

// จัดการปุ่ม "ดูข้อมูลเพิ่มเติม"
function updateMoreButton() {
  const moreButtonContainer = document.getElementById('moreButtonContainer');
  if (!moreButtonContainer) return;

  moreButtonContainer.innerHTML = ''; // เคลียร์ปุ่มก่อน

  // เช็คว่ามีข้อมูลเหลือให้โหลดเพิ่มหรือไม่
  if (currentIndex < allData.length) {
    const btn = document.createElement('button');
    btn.innerText = 'ดูข้อมูลเพิ่มเติม';
    btn.style.padding = '8px 16px';
    btn.style.margin = '10px auto';
    btn.style.display = 'inline-block';
    btn.style.cursor = 'pointer';

    btn.onclick = () => {
      updateTable(false);  // false = ไม่เคลียร์ข้อมูลเก่า
    };

    moreButtonContainer.appendChild(btn);
  }
}

// โหลดข้อมูลย้อนหลัง (เช่น สำหรับกราฟ)
async function fetchHistoricalData(range = '30d') {
  const url = `https://backend-water-rf88.onrender.com/distance?range=${range}&_=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  return data.filter(item => item.distance > 0);
}

// แปลงข้อมูลสำหรับกราฟ
function parseChartData(data) {
  const labels = [];
  const waterLevels = [];
  const voltagesNode1 = [];
  const voltagesNode2 = [];

  data.forEach(item => {
    const timeLabel = item.time_node1 || item.time_node2 || '';
    labels.push(timeLabel);

    const level = (item.distance && item.distance > 0) ? Number((fixedDepth - item.distance).toFixed(2)) : NaN;
    waterLevels.push(level);

    voltagesNode1.push(item.v_node1 > 0 ? item.v_node1 : NaN);
    voltagesNode2.push(item.v_node2 > 0 ? item.v_node2 : NaN);
  });

  return { labels, waterLevels, voltagesNode1, voltagesNode2 };
}

// สร้างกราฟทั้งหมด พร้อมสลับจุดข้อมูลให้กลับด้าน
async function createCharts() {
  try {
    const data30d = await fetchHistoricalData('30d');
    const data1h = await fetchHistoricalData('1h');

    const parsed30d = parseChartData(data30d);
    const parsed1h = parseChartData(data1h);

    // สลับลำดับข้อมูลกลับด้าน (เพื่อสลับจุดกราฟ)
    parsed30d.labels.reverse();
    parsed30d.waterLevels.reverse();
    parsed30d.voltagesNode1.reverse();
    parsed30d.voltagesNode2.reverse();

    parsed1h.labels.reverse();
    parsed1h.waterLevels.reverse();

    // กราฟ 30 วัน
    const ctx30d = document.getElementById('waterLevelChart30d').getContext('2d');
    new Chart(ctx30d, {
      type: 'line',
      data: {
        labels: parsed30d.labels,
        datasets: [{
          label: 'ระดับน้ำ (cm)',
          data: parsed30d.waterLevels,
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

    // กราฟ 1 ชั่วโมง
    const ctx1h = document.getElementById('waterLevelChart1h').getContext('2d');
    new Chart(ctx1h, {
      type: 'line',
      data: {
        labels: parsed1h.labels,
        datasets: [{
          label: 'ระดับน้ำ (cm)',
          data: parsed1h.waterLevels,
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

    // กราฟแบตเตอรี่
    const ctxBattery = document.getElementById('batteryChart').getContext('2d');
    new Chart(ctxBattery, {
      type: 'line',
      data: {
        labels: parsed30d.labels,
        datasets: [
          {
            label: 'แรงดัน Node 1 (V)',
            data: parsed30d.voltagesNode1,
            borderColor: '#ff7f00',
            backgroundColor: 'rgba(255,127,0,0.2)',
            fill: true,
            tension: 0.3,
            pointRadius: ctx => ctx.dataIndex === ctx.dataset.data.length - 1 ? 6 : 0,
            pointBackgroundColor: '#ff7f00',
          },
          {
            label: 'แรงดัน Node 2 (V)',
            data: parsed30d.voltagesNode2,
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
    console.error('Error creating charts:', err);
  }
}

// toggle เปิด/ปิดกล่องแสดง error
function toggleErrorBox() {
  const errorBox = document.getElementById('errorBox');
  if (!errorBox) return;
  errorBox.classList.toggle('hidden');
}

// อัปเดตรายการ error ที่เจอในข้อมูล
function updateErrorList(data) {
  const errorList = document.getElementById('errorList');
  if (!errorList) return;

  // กรองข้อมูลที่มี error
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
        errors.push(`เวลาวัด Node1 ขาดหาย`);
      }
      if (!item.time_node2) {
        errors.push(`เวลาวัด Node2 ขาดหาย`);
      }

      const li = document.createElement('li');
      li.innerHTML = `<strong>ข้อมูลที่เวลาวัด Node1: ${item.time_node1 || '-'} / Node2: ${item.time_node2 || '-'}</strong><br>${errors.join('<br>')}`;
      errorList.appendChild(li);
    });
  }
}

// เริ่มโหลดข้อมูลและอัปเดตทุก 5 วินาที
loadData();
setInterval(loadData, 5000);

// สร้างกราฟตอนโหลดหน้า
createCharts();
