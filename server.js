require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// ==== Mongo Client ====
const client = new MongoClient(MONGO_URI, {
  // ถ้าคุณใช้ Mongo Atlas/SSL สามารถคง options นี้ไว้ได้
  tls: true,
  tlsAllowInvalidCertificates: true,
});

// ==== Middlewares ====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// log แบบสั้นๆ (ดูว่า route โดนยิงไหม)
app.use((req, _res, next) => {
  console.log('> hit', req.method, req.url);
  next();
});

// ==== Health check ====
app.get('/healthz', (_req, res) => res.send('ok'));

// ==== Static page ====
app.get(['/', '/index'], (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==== POST /distance  (บันทึกข้อมูลแบบยืดหยุ่น) ====
app.post('/distance', async (req, res) => {
  try {
    const b = req.body;

    const doc = {
      distance: b.distance != null ? Number(b.distance) : NaN,
      rssi_node1: b.rssi_node1 != null ? Number(b.rssi_node1) : null,
      rssi_node2: b.rssi_node2 != null ? Number(b.rssi_node2) : null,
      v_node1:    b.v_node1    != null ? Number(b.v_node1)    : null,
      i_node1:    b.i_node1    != null ? Number(b.i_node1)    : null,
      v_node2:    b.v_node2    != null ? Number(b.v_node2)    : null,
      i_node2:    b.i_node2    != null ? Number(b.i_node2)    : null,
      time_node1: typeof b.time_node1 === 'string' ? b.time_node1 : null,
      time_node2: typeof b.time_node2 === 'string' ? b.time_node2 : null,
      timestamp: new Date(),
    };

    if (Number.isNaN(doc.distance)) {
      return res.status(400).json({ error: 'distance is required and must be a number' });
    }

    const db = client.db('esp32_data');
    const collection = db.collection('distances');
    await collection.insertOne(doc);

    res.json({ message: 'saved', ...doc });
  } catch (err) {
    console.error('Error saving data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==== GET /distance  (ไม่มี range = ดึงล่าสุด N แถว) ====
app.get('/distance', async (req, res) => {
  try {
    const db = client.db('esp32_data');
    const collection = db.collection('distances');

    const { range } = req.query;
    const LIMIT_LATEST = 200;

    let cursor;

    if (!range) {
      // ไม่มี range: คืนล่าสุด N แถว
      cursor = collection.find({}).sort({ timestamp: -1 }).limit(LIMIT_LATEST);
    } else {
      // มี range: กรองตามเวลา
      let fromDate = new Date();
      switch (range) {
        case '1h':  fromDate.setHours(fromDate.getHours() - 1); break;
        case '1d':  fromDate.setDate(fromDate.getDate() - 1);   break;
        case '7d':  fromDate.setDate(fromDate.getDate() - 7);   break;
        case '30d': fromDate.setDate(fromDate.getDate() - 30);  break;
        default:    fromDate.setDate(fromDate.getDate() - 1);   break;
      }
      cursor = collection.find({ timestamp: { $gte: fromDate } }).sort({ timestamp: -1 });
    }

    const distances = await cursor.toArray();

    // กัน cache
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.json(distances);
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ========= Water Tube (horizontal) ========= */
function drawWaterTube(containerId, value, min = 0, max = fixedDepth) {
  const el = document.getElementById(containerId);
  if (!el) return;

  // บีบค่าให้อยู่ในช่วง
  const v = Math.max(min, Math.min(max, Number(value) || 0));
  const ratio = (v - min) / (max - min);

  // เลือกสีตามช่วงระดับน้ำ
  let zoneColor;
  if (v < 40) {
    zoneColor = '#00e676'; // เขียว
  } else if (v < 70) {
    zoneColor = '#ff9800'; // ส้ม
  } else {
    zoneColor = '#f44336'; // แดง
  }

  // SVG หลอด + ของเหลว
  const svg = `
    <svg viewBox="0 0 1000 120" preserveAspectRatio="none">
      <!-- ท่อพื้นหลัง -->
      <rect x="20" y="30" width="960" height="40" rx="20" ry="20"
            fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.35)" stroke-width="3"/>
      <!-- ของเหลว -->
      <clipPath id="tube">
        <rect x="20" y="30" width="960" height="40" rx="20" ry="20"/>
      </clipPath>
      <rect x="20" y="30" width="${20 + 960*ratio}" height="40" clip-path="url(#tube)"
            fill="${zoneColor}"/>

      <!-- ขีด Min/Max -->
      <text x="20"  y="95" class="tube-label" style="font-size: 0.9rem; text-anchor:start;">${min.toFixed(0)} cm</text>
      <text x="980" y="95" class="tube-label" style="font-size: 0.9rem; text-anchor:end;">${max.toFixed(0)} cm</text>

      <!-- เข็มแสดงค่าปัจจุบัน -->
      <line x1="${20 + 960*ratio}" y1="18" x2="${20 + 960*ratio}" y2="82"
            stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${20 + 960*ratio}" cy="18" r="4" fill="#fff"/>

      <!-- ตัวเลขกลาง -->
      <text x="${20 + 960*ratio}" y="22" class="tube-label" style="font-size: 1.05rem;">${v.toFixed(1)} cm</text>
    </svg>`;
  el.innerHTML = svg;
}

// ==== Start Server ====
async function startServer() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    // สร้าง index เพื่อ query เร็วขึ้น
    const db = client.db('esp32_data');
    await db.collection('distances').createIndex({ timestamp: -1 });

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`ESP32 Distance API is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  }
}

startServer();

// ปิดโปรเซสอย่างนุ่มนวล
process.on('SIGTERM', async () => {
  try {
    await client.close(true);
  } finally {
    process.exit(0);
  }
});
process.on('SIGINT', async () => {
  try {
    await client.close(true);
  } finally {
    process.exit(0);
  }
});
