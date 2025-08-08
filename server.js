require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
  tls: true,
  tlsAllowInvalidCertificates: true,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '/public')));

// Routes
app.get(['/', '/index'], (req, res) => {
  res.sendFile(path.join(__dirname, '/public', 'index.html'));
});

// POST /distance รับข้อมูลหลายตัวและตรวจสอบชนิดข้อมูล
app.post('/distance', async (req, res) => {
  const {
    distance,
    rssi_node1,
    rssi_node2,
    v_node1,
    i_node1,
    v_node2,
    i_node2,
    time_node1,
    time_node2,
  } = req.body;

  if (
    typeof distance !== 'number' ||
    typeof rssi_node1 !== 'number' ||
    typeof rssi_node2 !== 'number' ||
    typeof v_node1 !== 'number' ||
    typeof i_node1 !== 'number' ||
    typeof v_node2 !== 'number' ||
    typeof i_node2 !== 'number' ||
    typeof time_node1 !== 'string' ||
    typeof time_node2 !== 'string'
  ) {
    return res.status(400).json({ error: 'Invalid data types in request body' });
  }

  try {
    const db = client.db('esp32_data');
    const collection = db.collection('distances');
    await collection.insertOne({
      distance,
      rssi_node1,
      rssi_node2,
      v_node1,
      i_node1,
      v_node2,
      i_node2,
      time_node1,
      time_node2,
      timestamp: new Date(),
    });

    res.json({
      message: 'Distance, RSSI, voltage, current and timestamps saved',
      distance,
      rssi_node1,
      rssi_node2,
      v_node1,
      i_node1,
      v_node2,
      i_node2,
      time_node1,
      time_node2,
    });
  } catch (err) {
    console.error('Error saving data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /distance ดึงข้อมูลตามช่วงเวลาที่ระบุใน query param ?range=
app.get('/distance', async (req, res) => {
  try {
    const db = client.db('esp32_data');
    const collection = db.collection('distances');

    const range = req.query.range || '1d'; // ค่าเริ่มต้น 1 วัน

    let fromDate = new Date();
    switch (range) {
      case '1h':
        fromDate.setHours(fromDate.getHours() - 1);
        break;
      case '1d':
        fromDate.setDate(fromDate.getDate() - 1);
        break;
      case '7d':
        fromDate.setDate(fromDate.getDate() - 7);
        break;
      case '30d':
        fromDate.setDate(fromDate.getDate() - 30);
        break;
      default:
        fromDate.setDate(fromDate.getDate() - 1); // กรณีไม่มี range หรือไม่ตรงกับเงื่อนไข กำหนดเป็น 1 วัน
    }

    const distances = await collection
      .find({ timestamp: { $gte: fromDate } })
      .sort({ timestamp: -1 })
      //.limit(1000)
      .toArray();

    // ป้องกัน cache ฝั่ง client และ proxy
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.json(distances);
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function startServer() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    app.listen(port, '0.0.0.0', () => {
      console.log(`ESP32 Distance API is running on port ${port}`);
    });
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
  }
}

startServer();
