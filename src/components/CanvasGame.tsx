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

export const CanvasGame = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [damage, setDamage] = useState(0);

    // Game Objects Refs (Persist across renders)
    const inputHandler = useRef<InputHandler | null>(null);
    const character = useRef<CharacterController | null>(null);
    const enemy = useRef<Enemy | null>(null);
    const renderer = useRef<SpriteRenderer | null>(null);
    const images = useRef<Record<string, HTMLImageElement>>({});

    // Initialize Game Objects
    useEffect(() => {
        inputHandler.current = new InputHandler();
        character.current = new CharacterController({ x: 100, y: 500 });
        enemy.current = new Enemy(600, 500);
        renderer.current = new SpriteRenderer();

        // Load Images
        Object.entries(ASSETS).forEach(([state, src]) => {
            const img = new Image();
            img.src = src;
            images.current[state] = img;
        });

        return () => {
            inputHandler.current?.destroy();
        };
    }, []);

    const update = useCallback((dt: number) => {
        if (!inputHandler.current || !character.current || !enemy.current) return;

        character.current.update(inputHandler.current, dt);
        enemy.current.update(dt, character.current.x);

        // Check Collision
        const hitbox = character.current.getHitbox();
        const hurtbox = enemy.current.getHurtbox();

        if (hitbox && !enemy.current.isHit) {
            if (Physics.checkCollision(hitbox, hurtbox)) {
                enemy.current.takeDamage(10);
                // Need to sync UI, but carefully
                // For now, let's just log or set damage (simple version)
                setDamage(prev => prev + 10);
                console.log("HIT!");
            }
        }
    }, [])

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !character.current || !renderer.current) {
            // console.log("Missing refs:", { canvas: !!canvas, char: !!character.current, rend: !!renderer.current });
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear Canvas (Absolute)
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // --- Camera Logic ---
        // Center camera on player, but clamp to left side (0)
        // canvas width is 800. Center is 400.
        const cameraX = Math.max(0, character.current.x - 300);

        ctx.save();
        ctx.translate(-cameraX, 0);

        // Draw Floor (extend to right)
        ctx.fillStyle = '#333';
        // Draw floor from start to far right
        ctx.fillRect(0, 500, 20000, canvas.height - 500);

        // Draw Background elements? (optional)

        // Get current sprite image
        const currentState = character.current.state;
        const currentImage = images.current[currentState] || null;

        // Draw Character
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

        // Draw Enemy
        if (enemy.current) {
            ctx.fillStyle = enemy.current.isHit ? 'white' : 'red';
            ctx.fillRect(enemy.current.x, enemy.current.y, enemy.current.width, enemy.current.height);

            // Debug Draw
            const eHurt = enemy.current.getHurtbox();
            ctx.strokeStyle = '#00FF00'; // Green = Hurtbox
            ctx.strokeRect(eHurt.x, eHurt.y, eHurt.width, eHurt.height);

            const cHit = character.current.getHitbox();
            if (cHit) {
                ctx.strokeStyle = '#FF0000'; // Red = Hitbox
                ctx.strokeRect(cHit.x, cHit.y, cHit.width, cHit.height);
            }
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
                <div className="absolute bottom-4 right-4 bg-red-900/80 p-4 rounded-lg transform rotate-[-2deg] border-2 border-red-500">
                    <div className="text-white font-black text-4xl drop-shadow-md">
                        {damage}%
                    </div>
                    <div className="text-red-200 text-xs uppercase tracking-widest font-bold">
                        Damage
                    </div>
                </div>

                {/* Controls Hint */}
                <div className="absolute top-4 left-4 text-white/50 text-sm font-mono">
                    <p>A/D: Move | SPACE: Jump</p>
                    <p>J: Jab | K: Kick</p>
                    <p>L: Strong Punch | M: Sweep</p>
                </div>
            </div>
        </div>
    );
};
