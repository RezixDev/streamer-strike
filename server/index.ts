
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import Game Logic
import { GameEngine } from '../src/game/GameEngine';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});

const PORT = 3000;

// Load Map Data (Mocking fetching on server side)
const mapPath = path.join(__dirname, '../public/sprites/maps/level1/map_data_level1.json');
let mapData: any = null;

try {
    const rawData = fs.readFileSync(mapPath, 'utf-8');
    mapData = JSON.parse(rawData);
    console.log("Map data loaded successfully.");
} catch (e) {
    console.error("Failed to load map data on server:", e);
}

// Initialize Game Engine
const game = new GameEngine('FRESH', mapData);

// Game Loop
const TICK_RATE = 60;
const TICK_MS = 1000 / TICK_RATE;

setInterval(() => {
    // Mock Input for now (or empty)
    const emptyInput = {
        left: false, right: false, up: false, down: false,
        jump: false, run: false,
        jab: false, kick: false, heavyPunch: false, sweep: false
    };

    game.update(TICK_MS, emptyInput);

    // Occasional Log to prove it's running
    if (Math.random() < 0.01) { // ~Every 100 ticks
        console.log(`[Server] Tick. Player Pos: (${game.character.x.toFixed(2)}, ${game.character.y.toFixed(2)})`);
    }

}, TICK_MS);


io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
