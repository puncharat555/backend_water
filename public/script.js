const fixedDepth = 120;

async function loadData() {
  try {
    const url = `https://backend-water-rf88.onrender.com/distance?_=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    const tbody = document.querySelector('#dataTable tbody');
    tbody.innerHTML = '';

    const filteredData = data.filter(item => item.distance > 0);

    filteredData.forEach(item => {
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

    // อัปเดตกล่อง error (ตัวอย่างสมมติ)
    updateErrorList(data);

    const latest = filteredData[0];
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
  }
}

function updateErrorList(data) {
  const errorList = document.getElementById('errorList');
  if (!errorList) return;

  // ตัวอย่าง: กรองข้อมูลที่มี distance <= 0
  const errorItems = data.filter(item => item.distance <= 0);

  if (errorItems.length === 0) {
    errorList.innerHTML = '<li>ไม่มีข้อมูลผิดปกติ</li>';
  } else {
    errorList.innerHTML = '';
    errorItems.forEach((item, i) => {
      const li = document.createElement('li');
      li.textContent = `แถวที่ ${i + 1}: ระดับน้ำดิบ = ${item.distance}`;
      errorList.appendChild(li);
    });
  }
}

// เพิ่มฟังก์ชัน toggleErrorBox (ต้องใส่จริง)
function toggleErrorBox() {
  const errorBox = document.getElementById('errorBox');
  if (!errorBox) return;
  errorBox.classList.toggle('hidden');
}

loadData();
setInterval(loadData, 5000);
