import { useRef, useEffect, useState, useCallback } from 'react';
import { useGameLoop } from '../hooks/useGameLoop';
import { InputHandler } from '../game/InputHandler';
import { CharacterController, CharacterState } from '../game/CharacterController';
import { SpriteRenderer } from '../game/SpriteRenderer';
import { Enemy } from '../game/Enemy';
import { Physics } from '../game/Physics';

// Placeholder or real paths - User can swap these
const ASSETS = {
    [CharacterState.IDLE]: '/sprites/fresh/idle.png',
    [CharacterState.RUNNING]: '/sprites/fresh/run.png',
    [CharacterState.JUMPING]: '/sprites/fresh/jump.png',
    [CharacterState.ATTACKING]: '/sprites/fresh/attack_kick.png',
    [CharacterState.JAB]: '/sprites/fresh/left_jab.png',
    [CharacterState.STRONG_PUNCH]: '/sprites/fresh/strong_punch.png',
    [CharacterState.WEAK_PUNCH]: '/sprites/fresh/weak_punch.png',
    [CharacterState.TORNADO_KICK]: '/sprites/fresh/tornado_kick.png',
    [CharacterState.SWEEP_KICK]: '/sprites/fresh/sweap_kick.png',
};

// Frame counts for each state
const FRAME_COUNTS = {
    [CharacterState.IDLE]: 4,
    [CharacterState.RUNNING]: 8,
    [CharacterState.JUMPING]: 9,
    [CharacterState.ATTACKING]: 6,
    [CharacterState.JAB]: 3,
    [CharacterState.STRONG_PUNCH]: 6,
    [CharacterState.WEAK_PUNCH]: 6,
    [CharacterState.TORNADO_KICK]: 4,
    [CharacterState.SWEEP_KICK]: 7,
};

const ENEMY_ASSETS = {
    SPAMMER: {
        IDLE: '/sprites/enemx/spammer/spammer_idle.png',
        RUN: '/sprites/enemx/spammer/spammer_run.png',
        ATTACK: '/sprites/enemx/spammer/spammer_walk.png', // Fallback
        HIT: '/sprites/enemx/spammer/spammer_idle.png'
    },
    TROLL: {
        IDLE: '/sprites/enemx/troll/troll_fight_idle.png',
        RUN: '/sprites/enemx/troll/troll_run.png',
        ATTACK: '/sprites/enemx/troll/troll_punch.png',
        HIT: '/sprites/enemx/troll/troll_fight_idle.png'
    }
};

const ENEMY_FRAME_COUNTS = {
    SPAMMER: { IDLE: 8, RUN: 8, ATTACK: 8, HIT: 8 },
    TROLL: { IDLE: 8, RUN: 6, ATTACK: 6, HIT: 8 }
};

export const CanvasGame = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [_, setTick] = useState(0); // Force render for UI updates
    const [gameOver, setGameOver] = useState(false);


    // Game Objects Refs (Persist across renders)
    const inputHandler = useRef<InputHandler | null>(null);
    const character = useRef<CharacterController | null>(null);
    const enemies = useRef<Enemy[]>([]);
    const renderer = useRef<SpriteRenderer | null>(null);
    const images = useRef<Record<string, HTMLImageElement>>({});

    // Initialize Game Objects
    useEffect(() => {
        inputHandler.current = new InputHandler();
        character.current = new CharacterController({ x: 100, y: 500 });

        // Spawn Enemies
        enemies.current = []; // Start empty, let spawner handle it


        renderer.current = new SpriteRenderer();

        // Load Player Images
        Object.entries(ASSETS).forEach(([state, src]) => {
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

        return () => {
            inputHandler.current?.destroy();
        };
    }, []);

    const update = useCallback((dt: number) => {
        if (!inputHandler.current || !character.current || !enemies.current) return;
        if (gameOver) return; // Stop update on game over

        character.current.update(inputHandler.current, dt);

        // Update Enemies
        enemies.current.forEach(enemy => {
            enemy.update(dt, character.current!.x);
        });

        // Check Collision
        const hitbox = character.current.getHitbox();

        if (hitbox) {
            enemies.current.forEach(enemy => {
                if (!enemy.isHit) {
                    const hurtbox = enemy.getHurtbox();
                    if (Physics.checkCollision(hitbox, hurtbox)) {
                        enemy.takeDamage(10);
                        // setDamage(prev => prev + 10);
                        setTick(t => t + 1); // Force update
                        console.log("HIT Enemy!", enemy.type);
                    }
                }
            });
        }

        // Check Enemy Attacks on Player & Solid Collision
        const playerHurtbox = character.current.getHurtbox();
        enemies.current.forEach(enemy => {
            const enemyHurtbox = enemy.getHurtbox();

            // Solid Collision (Body vs Body)
            if (Physics.checkCollision(enemyHurtbox, playerHurtbox)) {
                const resolution = Physics.resolveCollision(playerHurtbox, enemyHurtbox);
                character.current!.x += resolution.x;
                character.current!.y += resolution.y;
            }

            // Enemy Attack Damage (Active frames simulation)
            // Spammer Attack: Timer 20-30 (Duration 40)
            // Troll Attack: Timer 20-40 (Duration 60)
            let attackRange = 0;
            if (enemy.state === 'ATTACK') {
                if (enemy.type === 'SPAMMER' && enemy.attackTimer > 10 && enemy.attackTimer < 30) {
                    attackRange = 40;
                } else if (enemy.type === 'TROLL' && enemy.attackTimer > 20 && enemy.attackTimer < 40) {
                    attackRange = 60;
                }
            }

            if (attackRange > 0) {
                // Create a temporary attack hitbox based on facing direction
                // Direction 1 is Left, -1 is Right (based on Enemy.ts logic)
                const attackHitbox = {
                    x: enemy.direction === -1 ? enemy.x + 20 : enemy.x - 20 - attackRange,
                    y: enemy.y - 40,
                    width: attackRange,
                    height: 40
                };

                if (Physics.checkCollision(attackHitbox, playerHurtbox)) {
                    if (character.current && character.current.hitTimer === 0) {
                        character.current.takeDamage(10);
                        setTick(t => t + 1);
                        console.log("Player Hit by", enemy.type);
                    }
                }
            }
        });

        // Check Game Over
        if (character.current.hp <= 0 && !gameOver) {
            setGameOver(true);
        }

        // Random Spawning
        // 1% chance per frame if < 5 enemies
        if (enemies.current.length < 5 && Math.random() < 0.01) {
            const spawnX = character.current.x + 600 + Math.random() * 400; // 600-1000px ahead
            const type = Math.random() > 0.7 ? 'TROLL' : 'SPAMMER';
            enemies.current.push(new Enemy(spawnX, 500, type));
            console.log("Spawned", type, "at", spawnX);
        }

        // Remove dead enemies
        enemies.current = enemies.current.filter(enemy => enemy.hp > 0);
    }, [])

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !character.current || !renderer.current || !enemies.current) {
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear Canvas (Absolute)
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // --- Camera Logic ---
        const cameraX = Math.max(0, character.current.x - 300);

        ctx.save();
        ctx.translate(-cameraX, 0);

        // Draw Floor (extend to right)
        ctx.fillStyle = '#333';
        ctx.fillRect(0, 500, 20000, canvas.height - 500);

        // Draw Character
        const currentState = character.current.state;
        const currentImage = images.current[currentState] || null;

        renderer.current.draw(
            ctx,
            currentImage,
            character.current.x,
            character.current.y,
            character.current.width,
            character.current.height,
            character.current.direction,
            FRAME_COUNTS[currentState] || 1
        );

        // Draw Enemies
        enemies.current.forEach(enemy => {
            const enemyType = enemy.type;
            const enemyState = enemy.state;

            // Get correct image for enemy instance
            // Key format: TYPE_STATE (e.g., TROLL_RUN)
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
                    ENEMY_FRAME_COUNTS[enemyType][enemyState] || 1
                );
            } else {
                // Fallback Draw
                ctx.fillStyle = enemy.isHit ? 'white' : (enemyType === 'TROLL' ? 'green' : 'orange');
                ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            }

            // Debug Draw
            // const eHurt = enemy.getHurtbox();
            // ctx.strokeStyle = '#00FF00'; 
            // ctx.strokeRect(eHurt.x, eHurt.y, eHurt.width, eHurt.height);

            // Draw Health Bar
            const barWidth = 40;
            const barHeight = 4;
            const healthPct = Math.max(0, enemy.hp / enemy.maxHp);
            const barX = enemy.x - barWidth / 2;
            const barY = enemy.y - enemy.height - 10;

            // Background (Red)
            ctx.fillStyle = 'red';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // Foreground (Green)
            ctx.fillStyle = '#00FF00';
            ctx.fillRect(barX, barY, barWidth * healthPct, barHeight);

            // --- DEBUG VISUALS ---
            // 1. Draw Enemy Hurtbox (Blue)
            const eHurt = enemy.getHurtbox();
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 1;
            ctx.strokeRect(eHurt.x, eHurt.y, eHurt.width, eHurt.height);

            // 2. Draw State Text
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.fillText(enemy.state, enemy.x - 20, enemy.y - enemy.height - 20);

            // 3. Draw Attack Hitbox (Yellow) if attacking (Simulated for visual)
            let attackRange = 0;
            if (enemy.state === 'ATTACK') {
                if (enemy.type === 'SPAMMER' && enemy.attackTimer > 10 && enemy.attackTimer < 30) {
                    attackRange = 10;
                } else if (enemy.type === 'TROLL' && enemy.attackTimer > 20 && enemy.attackTimer < 40) {
                    attackRange = 1;
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
        });

        // Debug Player Hitbox
        const cHit = character.current.getHitbox();
        if (cHit) {
            ctx.strokeStyle = '#FF0000';
            ctx.strokeRect(cHit.x, cHit.y, cHit.width, cHit.height);
        }

        ctx.restore();
    }, [images]);

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
                            style={{ width: `${Math.max(0, (character.current?.hp || 100) / (character.current?.maxHp || 100) * 100)}%` }}
                        ></div>
                    </div>
                    <div className="text-right text-white text-sm mt-1">{character.current?.hp}/100</div>
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
            </div>
        </div>
    );
};
