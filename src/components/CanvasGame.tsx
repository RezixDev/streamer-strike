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

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [_, setTick] = useState(0); // Force render for UI updates
    const [gameOver, setGameOver] = useState(false);
    const [gameWon, setGameWon] = useState(false);


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
        gameEngine.current = new GameEngine(characterId);

        // Initialize Renderer
        renderer.current = new SpriteRenderer();

        // Connect to Server
        socketRef.current = io('http://localhost:3005');

        socketRef.current.on('connect', () => {
            console.log("Connected to Game Server");
        });

        socketRef.current.on('gameState', (state: any) => {
            if (gameEngine.current) {
                gameEngine.current.applySnapshot(state);
            }
        });

        return () => {
            inputHandler.current?.destroy();
            socketRef.current?.disconnect();
        };
    }, [characterId]);

    const update = useCallback((dt: number) => {
        if (!inputHandler.current || !gameEngine.current) return;

        // 1. Get Input
        const inputState = inputHandler.current.getState();

        // 2. Send Input to Server
        if (socketRef.current) {
            socketRef.current.emit('input', inputState);
        }

        // 3. Local Update (DISABLED for Phase 3 Authoritative Server)
        // gameEngine.current.update(dt, inputState);

        // 4. Update React State for UI (HP, Game Over)
        // We still need to check these flags from the engine (which is updated by snapshot)
        if (gameEngine.current.gameOver && !gameOver) setGameOver(true);
        if (gameEngine.current.gameWon && !gameWon) setGameWon(true);

    }, [gameOver, gameWon]);


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

        // --- Camera Logic ---
        const cameraX = Math.max(0, engine.character.x - 300);

        ctx.save();
        ctx.translate(-cameraX, 0);

        // Draw Map
        engine.tileMap.draw(ctx, cameraX, canvas.width, canvas.height);

        // Draw Character
        const currentState = engine.character.state;
        const currentImage = images.current[currentState] || null;
        const charConfig = CHARACTERS[characterId];
        const offsetY = charConfig.hitboxConfig?.offsetY || 0;

        renderer.current.draw(
            ctx,
            currentImage,
            engine.character.x,
            engine.character.y + offsetY, // Apply visual offset
            engine.character.width,
            engine.character.height,
            engine.character.direction,
            charConfig.frameCounts[currentState as CharacterState] || 1,
            dt
        );

        // Draw Enemies
        engine.enemies.forEach(enemy => {
            const enemyType = enemy.type;
            const enemyState = enemy.state;
            const imgKey = `${enemyType}_${enemyState}`;
            const img = images.current[imgKey];

            if (img) {
                enemy.renderer.draw(
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

                // 3. Draw Attack Hitbox (Yellow)
                let attackRange = 0;
                if (enemy.state === 'ATTACK') {
                    if (enemy.type === 'SPAMMER' && enemy.attackTimer > 167 && enemy.attackTimer < 500) {
                        attackRange = 40;
                    } else if (enemy.type === 'TROLL' && enemy.attackTimer > 333 && enemy.attackTimer < 667) {
                        attackRange = 60;
                    }
                }
                if (attackRange > 0) {
                    const attackHitbox = {
                        x: enemy.direction === -1 ? enemy.x + 20 : enemy.x - 20 - attackRange,
                        y: enemy.y - 40,
                        width: attackRange,
                        height: 40
                    };
                    ctx.strokeStyle = 'yellow';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(attackHitbox.x, attackHitbox.y, attackHitbox.width, attackHitbox.height);
                }
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

        // Debug Player Hitbox
        if (debugMode) {
            const cHit = engine.character.getHitbox();
            if (cHit) {
                ctx.strokeStyle = '#FF0000';
                ctx.strokeRect(cHit.x, cHit.y, cHit.width, cHit.height);
            }
            // Also draw player hurtbox for clarity in debug
            const pHurt = engine.character.getHurtbox();
            ctx.strokeStyle = 'green';
            ctx.strokeRect(pHurt.x, pHurt.y, pHurt.width, pHurt.height);
        }

        ctx.restore();
    }, [images, debugMode]);

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
                            style={{ width: `${Math.max(0, (gameEngine.current?.character.hp || 100) / (gameEngine.current?.character.maxHp || 100) * 100)}%` }}
                        ></div>
                    </div>
                    <div className="text-right text-white text-sm mt-1">{gameEngine.current?.character.hp}/100</div>
                </div>

                {/* Controls Hint */}
                <div className="absolute top-4 left-4 text-white/50 text-sm font-mono">
                    <p>A/D: Move | SPACE: Jump</p>
                    <p>J: Jab | K: Kick</p>
                    <p>L: Strong Punch | M: Sweep</p>
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
