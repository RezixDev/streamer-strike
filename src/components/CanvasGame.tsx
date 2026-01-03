import { useRef, useEffect, useState, useCallback } from 'react';
import { useGameLoop } from '../hooks/useGameLoop';
import { InputHandler } from '../game/InputHandler';
import { SpriteRenderer } from '../game/SpriteRenderer';
import { GameEngine } from '../game/GameEngine';
import { CharacterState } from '../game/CharacterController';
import { CHARACTERS } from '../game/Characters';
import { io, Socket } from 'socket.io-client';

// Helper to prepend base path
const BASE = import.meta.env.BASE_URL;


// ENEMY_ASSETS and other constants remain...

const ENEMY_ASSETS = {
    SPAMMER: {
        IDLE: `${BASE}sprites/enemx/spammer/spammer_idle.png`,
        RUN: `${BASE}sprites/enemx/spammer/spammer_run.png`,
        ATTACK: `${BASE}sprites/enemx/spammer/spammer_jump.png`, // Switched to Jump for better visual
        HIT: `${BASE}sprites/enemx/spammer/spammer_idle.png`
    },
    TROLL: {
        IDLE: `${BASE}sprites/enemx/troll/troll_fight_idle.png`,
        RUN: `${BASE}sprites/enemx/troll/troll_run.png`,
        ATTACK: `${BASE}sprites/enemx/troll/troll_punch.png`,
        HIT: `${BASE}sprites/enemx/troll/troll_fight_idle.png`
    }
};

const ENEMY_FRAME_COUNTS = {
    SPAMMER: { IDLE: 8, RUN: 8, ATTACK: 8, HIT: 8 },
    TROLL: { IDLE: 8, RUN: 6, ATTACK: 6, HIT: 8 }
};

const COLLECTIBLE_ASSETS = {
    HEART: `${BASE}sprites/collectibles/heart.png`
};

export const CanvasGame = ({ characterId = 'FRESH' }: { characterId?: string }) => {

    const [debugMode, setDebugMode] = useState(false);
    const [myId, setMyId] = useState<string | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [_, setTick] = useState(0); // Force render for UI updates
    const [gameOver, setGameOver] = useState(false);
    const [gameWon, setGameWon] = useState(false);
    const [isOnline, setIsOnline] = useState<boolean | null>(null); // null = detecting


    const gameEngine = useRef<GameEngine | null>(null);
    const inputHandler = useRef<InputHandler | null>(null);
    const renderer = useRef<SpriteRenderer | null>(null);
    const images = useRef<Record<string, HTMLImageElement>>({});

    const socketRef = useRef<Socket | null>(null);

    // Load assets
    useEffect(() => {
        // Load Player Images
        const charConfig = CHARACTERS[characterId];
        Object.entries(charConfig.assets).forEach(([state, src]) => {
            const img = new Image();
            img.src = src;
            images.current[state] = img;
        });

        // Load Enemy Images
        Object.entries(ENEMY_ASSETS).forEach(([type, states]) => {
            Object.entries(states).forEach(([state, src]) => {
                const img = new Image();
                img.src = src;
                const key = `${type}_${state}`;
                images.current[key] = img;
            });
        });

        // Load Collectible Images
        Object.entries(COLLECTIBLE_ASSETS).forEach(([type, src]) => {
            const img = new Image();
            img.src = src;
            images.current[type] = img;
        });
    }, [characterId]);

    // Initialize Game Engine & Socket
    useEffect(() => {
        inputHandler.current = new InputHandler();
        gameEngine.current = new GameEngine();

        // Initialize Renderer
        renderer.current = new SpriteRenderer();

        // Try to Connect to Server with timeout
        const socket = io('http://localhost:3005', {
            timeout: 3000, // 3 second connection timeout
            reconnectionAttempts: 1
        });
        socketRef.current = socket;

        const connectionTimeout = setTimeout(() => {
            if (!socket.connected) {
                console.log("Server not available - Starting OFFLINE mode");
                setIsOnline(false);
                socket.disconnect();
                // Add local player for offline mode
                if (gameEngine.current) {
                    gameEngine.current.addPlayer('local');
                    setMyId('local');
                }
            }
        }, 3000);

        socket.on('connect', () => {
            clearTimeout(connectionTimeout);
            console.log("Connected to Game Server - ONLINE mode");
            setIsOnline(true);
        });

        socket.on('welcome', (data: { id: string }) => {
            console.log("Welcome! My ID:", data.id);
            setMyId(data.id);
        });

        socket.on('gameState', (state: any) => {
            // If we receive gameState from server, we're online - apply it
            if (gameEngine.current) {
                gameEngine.current.applySnapshot(state);
            }
        });

        socket.on('disconnect', () => {
            console.log("Disconnected from server");
            // Optionally switch to offline mode on disconnect
        });

        socket.on('connect_error', () => {
            clearTimeout(connectionTimeout);
            console.log("Connection error - Starting OFFLINE mode");
            setIsOnline(false);
            socket.disconnect();
            // Add local player for offline mode
            if (gameEngine.current) {
                gameEngine.current.addPlayer('local');
                setMyId('local');
            }
        });

        return () => {
            clearTimeout(connectionTimeout);
            inputHandler.current?.destroy();
            socketRef.current?.disconnect();
        };
    }, [characterId]);

    const update = useCallback((dt: number) => {
        if (!inputHandler.current || !gameEngine.current) return;

        // 1. Get Input
        const inputState = inputHandler.current.getState();

        if (isOnline) {
            // ONLINE MODE: Send input to server, rely on server state
            if (socketRef.current?.connected) {
                socketRef.current.emit('input', inputState);
            }
        } else if (isOnline === false) {
            // OFFLINE MODE: Run game locally
            gameEngine.current.update(dt, { 'local': inputState });
        }
        // else: isOnline === null means still detecting, do nothing

        // Update React State for UI (HP, Game Over)
        if (gameEngine.current.gameOver && !gameOver) setGameOver(true);
        if (gameEngine.current.gameWon && !gameWon) setGameWon(true);

    }, [gameOver, gameWon, isOnline]);


    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Backquote') {
                setDebugMode(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const draw = useCallback((dt: number) => {
        const canvas = canvasRef.current;
        if (!canvas || !gameEngine.current || !renderer.current) {
            return;
        }
        const engine = gameEngine.current;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear Canvas (Absolute)
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Find My Character
        const myCharacter = myId ? engine.players.get(myId) : null;

        // --- Camera Logic ---
        // Follow my character, or default to 0 if not spawned yet
        const focusX = myCharacter ? myCharacter.x : 100;
        const focusY = myCharacter ? myCharacter.y : 100;

        // Camera Viewport Size
        const viewW = canvas.width;
        const viewH = canvas.height;

        // Center on player
        let cameraX = focusX - viewW / 2;
        let cameraY = focusY - viewH / 2;

        // Clamp to Map Bounds (Assuming Map Size or fallback)
        // Arena is 64x16 tiles * 64px = 4096x1024
        // Hardcoding standard map size limits or reading from engine if available
        // For now, simple clamp to positive, and maybe max height
        cameraX = Math.max(0, cameraX);
        cameraY = Math.max(0, Math.min(cameraY, 1024 - viewH)); // Clamp Y to map height

        ctx.save();
        ctx.translate(-cameraX, -cameraY);

        // Draw Map
        engine.tileMap.draw(ctx, cameraX, cameraY, canvas.width, canvas.height);

        // Draw Players
        engine.players.forEach((character, id) => {
            const currentState = character.state;
            const currentImage = images.current[currentState] || null;
            const charConfig = CHARACTERS[characterId]; // Simplify: assume all use same skin for now
            const offsetY = charConfig.hitboxConfig?.offsetY || 0;

            // Draw Character
            if (renderer.current) {
                renderer.current.draw(
                    ctx,
                    currentImage,
                    character.x,
                    character.y + offsetY,
                    character.width,
                    character.height,
                    character.direction,
                    charConfig.frameCounts[currentState as CharacterState] || 1,
                    dt
                );

                // Draw ID above head
                ctx.fillStyle = id === myId ? '#00FF00' : 'white';
                ctx.font = '12px Arial';
                ctx.fillText(id.substr(0, 4), character.x + 10, character.y - 10);
            }
        });

        // Draw Enemies
        engine.enemies.forEach(enemy => {
            const enemyType = enemy.type;
            const enemyState = enemy.state;
            const imgKey = `${enemyType}_${enemyState}`;
            const img = images.current[imgKey];

            if (img && renderer.current) {
                renderer.current.draw(
                    ctx,
                    img,
                    enemy.x,
                    enemy.y,
                    enemy.width,
                    enemy.height,
                    enemy.direction,
                    ENEMY_FRAME_COUNTS[enemyType][enemyState] || 1,
                    dt
                );
            } else {
                ctx.fillStyle = enemy.isHit ? 'white' : (enemyType === 'TROLL' ? 'green' : 'orange');
                ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            }

            // Draw Health Bar
            const barWidth = 40;
            const barHeight = 4;
            const healthPct = Math.max(0, enemy.hp / enemy.maxHp);
            const barX = enemy.x - barWidth / 2;
            const barY = enemy.y - enemy.height - 10;

            ctx.fillStyle = 'red';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            ctx.fillStyle = '#00FF00';
            ctx.fillRect(barX, barY, barWidth * healthPct, barHeight);

            // --- DEBUG VISUALS ---
            if (debugMode) {
                // 1. Draw Enemy Hurtbox (Blue)
                const eHurt = enemy.getHurtbox();
                ctx.strokeStyle = 'blue';
                ctx.lineWidth = 1;
                ctx.strokeRect(eHurt.x, eHurt.y, eHurt.width, eHurt.height);

                // 2. Draw State Text
                ctx.fillStyle = 'white';
                ctx.font = '12px Arial';
                ctx.fillText(enemy.state, enemy.x - 20, enemy.y - enemy.height - 20);
            }
        });

        // Draw Collectibles
        engine.collectibles.forEach(collectible => {
            const img = images.current[collectible.type];
            if (img) {
                ctx.drawImage(img, collectible.x, collectible.y, collectible.width, collectible.height);
            } else {
                ctx.fillStyle = 'pink';
                ctx.fillRect(collectible.x, collectible.y, collectible.width, collectible.height);
            }
        });

        ctx.restore();
    }, [images, debugMode, myId]);

    useGameLoop({ onUpdate: update, onDraw: draw });

    return (
        <div className="relative w-full h-screen bg-neutral-900 flex justify-center items-center">
            <div className="relative border-4 border-gray-700 bg-black shadow-2xl rounded-lg overflow-hidden">
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={600}
                    className="block"
                />

                {/* HUD Overlay */}
                <div className="absolute top-4 right-4 bg-gray-900/80 p-4 rounded-lg border-2 border-blue-500 w-64">
                    <div className="text-white font-bold mb-1">PLAYER HEALTH</div>
                    <div className="w-full bg-gray-700 h-4 rounded-full overflow-hidden">
                        <div
                            className="bg-blue-500 h-full transition-all duration-100"
                            style={{ width: `${Math.max(0, ((gameEngine.current?.players.get(myId || '')?.hp || 100) / 100) * 100)}%` }}
                        ></div>
                    </div>
                    <div className="text-right text-white text-sm mt-1">{gameEngine.current?.players.get(myId || '')?.hp || 0}/100</div>
                </div>

                {/* Controls Hint */}
                <div className="absolute top-4 left-4 text-white/50 text-sm font-mono">
                    <p>A/D: Move | SPACE: Jump</p>
                    <p>J: Jab | K: Kick</p>
                    <p>L: Strong Punch | M: Sweep</p>
                </div>

                {/* Mode Indicator */}
                <div className={`absolute bottom-4 left-4 px-3 py-1 rounded-full text-xs font-bold ${isOnline === null ? 'bg-yellow-500 text-black' :
                    isOnline ? 'bg-green-500 text-black' : 'bg-orange-500 text-black'
                    }`}>
                    {isOnline === null ? '⏳ CONNECTING...' :
                        isOnline ? '🌐 ONLINE' : '💻 OFFLINE'}
                </div>

                {/* Game Over Modal */}
                {gameOver && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
                        <h1 className="text-6xl font-black text-red-600 mb-4 drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]">GAME OVER</h1>
                        <button
                            className="px-8 py-3 bg-white text-black font-bold text-xl rounded hover:bg-gray-200 transition-colors"
                            onClick={() => window.location.reload()}
                        >
                            TRY AGAIN
                        </button>
                    </div>
                )}

                {/* Win Modal */}
                {gameWon && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
                        <h1 className="text-6xl font-black text-green-500 mb-4 drop-shadow-[0_0_10px_rgba(0,255,0,0.8)]">YOU WON!</h1>
                        <p className="text-white text-xl mb-8">You survived the Strike!</p>
                        <button
                            className="px-8 py-3 bg-white text-black font-bold text-xl rounded hover:bg-gray-200 transition-colors"
                            onClick={() => window.location.reload()}
                        >
                            PLAY AGAIN
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
