const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

// ใช้ CORS และ JSON middleware
app.use(cors());
app.use(express.json());

// Serve static files จากโฟลเดอร์ public
app.use(express.static(path.join(__dirname, '/public')));

// Route สำหรับหน้า index (root) และ /index
app.get(['/', '/index'], (req, res) => {
  res.sendFile(path.join(__dirname, '/public', 'index.html'));
});

// MongoDB URI ของคุณ
const uri = 'mongodb+srv://espuser:esp12345@cluster0.nbmml.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri, {
  tls: true,
  tlsAllowInvalidCertificates: true,
});

async function connectDB() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
  }
}
connectDB();

// Endpoint POST: รับค่าจาก ESP32
app.post('/distance', async (req, res) => {
  const { distance, rssi } = req.body;

  if (typeof distance !== 'number' || typeof rssi !== 'number') {
    return res.status(400).json({ error: 'Distance and RSSI must be numbers' });
  }

  try {
    const db = client.db('esp32_data');
    const collection = db.collection('distances');
    await collection.insertOne({ distance, rssi, timestamp: new Date() });

    res.json({ message: '✅ Distance and RSSI saved', distance, rssi });
  } catch (err) {
    console.error('❌ Error saving data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint GET: ดึงข้อมูลระยะทางล่าสุด 100 ค่า
app.get('/distance', async (req, res) => {
  try {
    const db = client.db('esp32_data');
    const collection = db.collection('distances');
    const distances = await collection.find().sort({ timestamp: -1 }).limit(100).toArray();

    res.json(distances);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`🚀 ESP32 Distance API is running at http://localhost:${port}`);
});
