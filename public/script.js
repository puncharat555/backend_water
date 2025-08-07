const fixedDepth = 120;
let allData = [];
let currentIndex = 0;
const pageSize = 10;

// โหลดข้อมูลปัจจุบัน และอัปเดต UI
async function loadData() {
  try {
    const url = `https://backend-water-rf88.onrender.com/distance?_=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    // กรองเฉพาะ distance > 0
    allData = data.filter(item => item.distance > 0);
    currentIndex = 0;

    updateTable(true); // เคลียร์ตารางก่อนเพิ่มข้อมูล
    updateErrorList(data); // แสดง error

    // แสดงข้อมูลล่าสุด (index 0)
    const latest = allData[0];
    if (latest) {
      const level = (fixedDepth - latest.distance).toFixed(1);
      document.getElementById('waterLevelNode1').innerText = `ระดับน้ำ: ${level} cm`;
      document.getElementById('rssiNode1').innerText = latest.rssi_node1 ? `RSSI: ${latest.rssi_node1}` : 'RSSI: -';
      document.getElementById('voltageNode1').innerText = latest.v_node1 > 0 ? `แรงดัน: ${latest.v_node1} V` : 'แรงดัน: -';
      document.getElementById('currentNode1').innerText = latest.i_node1 > 0 ? `กระแส: ${latest.i_node1} mA` : 'กระแส: -';
      document.getElementById('timeNode1').innerText = latest.time_node1 || 'เวลาวัด: -';

      document.getElementById('rssiNode2').innerText = latest.rssi_node2 ? `RSSI: ${latest.rssi_node2}` : 'RSSI: -';
      document.getElementById('voltageNode2').innerText = latest.v_node2 > 0 ? `แรงดัน: ${latest.v_node2} V` : 'แรงดัน: -';
      document.getElementById('currentNode2').innerText = latest.i_node2 > 0 ? `กระแส: ${latest.i_node2} mA` : 'กระแส: -';
      document.getElementById('timeNode2').innerText = latest.time_node2 || 'เวลาวัด: -';
    }

  } catch (error) {
    console.error('Load data error:', error);
    // แสดงข้อความ error และล้างข้อมูล UI
    ['waterLevelNode1', 'rssiNode1', 'voltageNode1', 'currentNode1', 'timeNode1',
     'rssiNode2', 'voltageNode2', 'currentNode2', 'timeNode2'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.innerText = '-';
    });
    const waterLevelEl = document.getElementById('waterLevelNode1');
    if(waterLevelEl) waterLevelEl.innerText = 'โหลดข้อมูลล้มเหลว';

    const tbody = document.querySelector('#dataTable tbody');
    if(tbody) tbody.innerHTML = '';
    const moreButtonContainer = document.getElementById('moreButtonContainer');
    if(moreButtonContainer) moreButtonContainer.innerHTML = '';
  }
}

// ฟังก์ชันอัปเดตตาราง โดยแบ่งหน้า (pagination)
function updateTable(clear = false) {
  const tbody = document.querySelector('#dataTable tbody');
  if(!tbody) return;

  if(clear) {
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
      <td>${item.rssi_node1 && item.rssi_node1 !== 0 ? item.rssi_node1 : '-'}</td>
      <td>${item.rssi_node2 && item.rssi_node2 !== 0 ? item.rssi_node2 : '-'}</td>
      <td>${item.v_node1 && item.v_node1 > 0 ? item.v_node1 + ' V' : '-'}</td>
      <td>${item.i_node1 && item.i_node1 > 0 ? item.i_node1 + ' mA' : '-'}</td>
      <td>${item.v_node2 && item.v_node2 > 0 ? item.v_node2 + ' V' : '-'}</td>
      <td>${item.i_node2 && item.i_node2 > 0 ? item.i_node2 + ' mA' : '-'}</td>
      <td>${item.time_node1 || '-'}</td>
      <td>${item.time_node2 || '-'}</td>
    `;
    tbody.appendChild(tr);
  });

  currentIndex += sliceData.length;

  updateMoreButton();
}

// ปุ่ม "ดูข้อมูลเพิ่มเติม" เพื่อโหลดข้อมูลแถวถัดไป
function updateMoreButton() {
  const moreButtonContainer = document.getElementById('moreButtonContainer');
  if(!moreButtonContainer) return;

  moreButtonContainer.innerHTML = '';

  if(currentIndex < allData.length) {
    const btn = document.createElement('button');
    btn.innerText = 'ดูข้อมูลเพิ่มเติม';
    btn.style.padding = '8px 16px';
    btn.style.margin = '10px auto';
    btn.style.display = 'inline-block';
    btn.style.cursor = 'pointer';
    btn.onclick = () => updateTable(false);
    moreButtonContainer.appendChild(btn);
  }
}

// ฟังก์ชันเช็ค error ในข้อมูลและแสดง
function updateErrorList(data) {
  const errorList = document.getElementById('errorList');
  if(!errorList) return;

  const errorItems = data.filter(item => {
    return (
      !item.distance || item.distance <= 0 || item.distance > fixedDepth ||
      !item.rssi_node1 || item.rssi_node1 === 0 ||
      !item.rssi_node2 || item.rssi_node2 === 0 ||
      !item.v_node1 || item.v_node1 <= 0 ||
      !item.v_node2 || item.v_node2 <= 0 ||
      !item.i_node1 || item.i_node1 <= 0 ||
      !item.i_node2 || item.i_node2 <= 0 ||
      !item.time_node1 || !item.time_node2
    );
  });

  if(errorItems.length === 0) {
    errorList.innerHTML = '<li>ไม่มีข้อมูลผิดปกติ</li>';
  } else {
    errorList.innerHTML = '';
    errorItems.forEach(item => {
      const errors = [];
      if(!item.distance || item.distance <= 0 || item.distance > fixedDepth) errors.push(`ระดับน้ำดิบผิดปกติ: ${item.distance}`);
      if(!item.rssi_node1 || item.rssi_node1 === 0) errors.push(`RSSI Node1 ผิดปกติ: ${item.rssi_node1}`);
      if(!item.rssi_node2 || item.rssi_node2 === 0) errors.push(`RSSI Node2 ผิดปกติ: ${item.rssi_node2}`);
      if(!item.v_node1 || item.v_node1 <= 0) errors.push(`แรงดัน Node1 ผิดปกติ: ${item.v_node1}`);
      if(!item.v_node2 || item.v_node2 <= 0) errors.push(`แรงดัน Node2 ผิดปกติ: ${item.v_node2}`);
      if(!item.i_node1 || item.i_node1 <= 0) errors.push(`กระแส Node1 ผิดปกติ: ${item.i_node1}`);
      if(!item.i_node2 || item.i_node2 <= 0) errors.push(`กระแส Node2 ผิดปกติ: ${item.i_node2}`);
      if(!item.time_node1) errors.push(`เวลาวัด Node1 ขาดหาย`);
      if(!item.time_node2) errors.push(`เวลาวัด Node2 ขาดหาย`);

      const li = document.createElement('li');
      li.innerHTML = `<strong>เวลาวัด Node1: ${item.time_node1 || '-'} / Node2: ${item.time_node2 || '-'}</strong><br>${errors.join('<br>')}`;
      errorList.appendChild(li);
    });
  }
}

// เรียกโหลดข้อมูลและอัปเดตทุก 5 วินาที
loadData();
setInterval(loadData, 5000);

// สร้างกราฟย้อนหลังตอนโหลดหน้า
createCharts();
