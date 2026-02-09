require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const fs = require('fs');
const whatsappService = require('./services/whatsappClient');

const app = express();
const PORT = process.env.PORT || 3000;

// --- SECURITY & CORS ---
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());

// --- SERVER SETUP ---
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

// Serve Static Frontend (if needed as fallback)
const CLIENT_BUILD_PATH = path.join(__dirname, '../client/dist');
if (fs.existsSync(CLIENT_BUILD_PATH)) {
    app.use(express.static(CLIENT_BUILD_PATH));
}

// --- INITIALIZE SERVICE ---
// Inject Socket.IO into the service for real-time logs
whatsappService.setSocket(io);

// --- ROUTES ---
app.get('/whatsapp/status', (req, res) => res.json(whatsappService.getStatus()));
app.get('/api/whatsapp/status', (req, res) => res.json(whatsappService.getStatus()));

app.post('/whatsapp/restart', async (req, res) => {
    const success = await whatsappService.clearSession();
    if (success) {
        whatsappService.initializeClient();
        res.json({ success: true, message: "Session cleared. Restarting..." });
    } else {
        res.status(500).json({ success: false, message: "Failed to clear session." });
    }
});

app.get('/health', (req, res) => res.send('OK'));

// Start Server
server.listen(PORT, () => {
    console.log(`🚀 WA Server Running on ${PORT} | Mode: Unified Service`);
});
