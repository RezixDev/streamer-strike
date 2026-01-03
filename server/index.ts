
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

const PORT = 3005;

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
    game.update(TICK_MS, currentInput);

    // Occasional Log to prove it's running
    if (Math.random() < 0.01) { // ~Every 100 ticks
        console.log(`[Server] Tick. Player Pos: (${game.character.x.toFixed(2)}, ${game.character.y.toFixed(2)})`);
    }
    // Emit Game State
    io.emit('gameState', game.getSnapshot());

}, TICK_MS);


io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('input', (input: any) => {
        // Apply input immediately for next tick
        // Naive: Overwrite last input
        // game.update needs to process this.
        // For Phase 3, we just pass the input to the game engine somehow or store it.
        // Current GameEngine.update takes "input" as arg.
        // Real logic: We need to store input for the specific player (if defined)
        // or just apply it globally if single player test.
        // Let's assume global input buffer for single player testing over network.
        currentInput = input;
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

let currentInput: any = {
    left: false, right: false, up: false, down: false,
    jump: false, run: false,
    jab: false, kick: false, heavyPunch: false, sweep: false
};


httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
