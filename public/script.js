const fixedDepth = 120;
let allData = [];       // เก็บข้อมูลทั้งหมด
let isShowingAll = false;  // สถานะแสดงข้อมูลทั้งหมดหรือไม่

// โหลดข้อมูลปัจจุบันแสดงใน node และตาราง
async function loadData() {
  try {
    const url = `https://backend-water-rf88.onrender.com/distance?_=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    // กรองข้อมูล distance > 0 เท่านั้น และเก็บไว้ทั้งหมด
    allData = data.filter(item => item.distance > 0);

    renderTable();  // แสดงข้อมูลในตาราง (10 แถว หรือทั้งหมด ตามสถานะ)
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
  }
}

// แสดงข้อมูลในตารางตามสถานะ isShowingAll
function renderTable() {
  const tbody = document.querySelector('#dataTable tbody');
  tbody.innerHTML = '';

  // ถ้าแสดงทั้งหมด ก็นำข้อมูลทั้งหมด ถ้าไม่แสดงทั้งหมด ให้จำกัดแค่ 10 แถว
  const dataToShow = isShowingAll ? allData : allData.slice(0, 10);

  dataToShow.forEach(item => {
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

  // ปุ่มแสดงเพิ่มเติม ถ้ามีข้อมูลเกิน 10 แถว
  const moreBtnContainer = document.getElementById('moreButtonContainer');
  if (allData.length > 10) {
    moreBtnContainer.innerHTML = `<button id="toggleMoreBtn">${isShowingAll ? 'ย่อข้อมูล' : 'ดูข้อมูลเพิ่มเติม'}</button>`;
    document.getElementById('toggleMoreBtn').addEventListener('click', () => {
      isShowingAll = !isShowingAll;
      renderTable();
    });
  } else {
    moreBtnContainer.innerHTML = '';
  }
}

// ฟังก์ชันอื่น ๆ ของคุณไม่ต้องแก้ เช่น fetchHistoricalData, parseChartData, createCharts

// ฟังก์ชัน toggle เพื่อเปิด/ปิด error box
function toggleErrorBox() {
  const errorBox = document.getElementById('errorBox');
  if (!errorBox) return;
  errorBox.classList.toggle('hidden');
}

// ฟังก์ชันอัปเดตรายการ error (เช่นข้อมูลที่ผิดปกติ)
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
    errorItems.forEach((item, i) => {
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

// เริ่มโหลดข้อมูล และตั้ง interval
loadData();
setInterval(loadData, 5000);

// สร้างกราฟตอนโหลดหน้า
createCharts();
