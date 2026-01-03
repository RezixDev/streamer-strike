
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
const mapPath = path.join(__dirname, '../public/sprites/maps/arena/arena.json');
let mapData: any = null;

try {
    const rawData = fs.readFileSync(mapPath, 'utf-8');
    mapData = JSON.parse(rawData);
    console.log("Map data loaded successfully.");
} catch (e) {
    console.error("Failed to load map data on server:", e);
}

// Initialize Game Engine
const game = new GameEngine(mapData);

// Game Loop
const TICK_RATE = 60;
const TICK_MS = 1000 / TICK_RATE;

setInterval(() => {
    game.update(TICK_MS, inputs);

    // Occasional Log to prove it's running
    if (Math.random() < 0.01) { // ~Every 100 ticks
        console.log(`[Server] Tick. Players: ${game.players.size}`);
    }
    // Emit Game State
    io.emit('gameState', game.getSnapshot());

}, TICK_MS);


const inputs: Record<string, any> = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Wait for joinGame event with character type before adding player
    socket.on('joinGame', (data: { characterType?: string }) => {
        const characterType = data?.characterType || 'FRESH';
        console.log(`Player ${socket.id} joining as ${characterType}`);
        game.addPlayer(socket.id, characterType);
        inputs[socket.id] = {
            left: false, right: false, up: false, down: false,
            jump: false, run: false,
            jab: false, kick: false, heavyPunch: false, sweep: false
        };
        // Send Welcome event with player ID
        socket.emit('welcome', { id: socket.id });
    });

    socket.on('input', (input: any) => {
        inputs[socket.id] = input;
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        game.removePlayer(socket.id);
        delete inputs[socket.id];
    });
});



httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
