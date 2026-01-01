import { InputHandler } from './InputHandler';
import { TileMap } from './TileMap';
import { Physics, type Rectangle } from './Physics';

export const CharacterState = {
    IDLE: 'IDLE',
    RUNNING: 'RUNNING',
    JUMPING: 'JUMPING',
    ATTACKING: 'ATTACKING', // Standard Kick
    JAB: 'JAB',
    STRONG_PUNCH: 'STRONG_PUNCH',
    WEAK_PUNCH: 'WEAK_PUNCH',
    TORNADO_KICK: 'TORNADO_KICK',
    SWEEP_KICK: 'SWEEP_KICK',
} as const;

export type CharacterState = typeof CharacterState[keyof typeof CharacterState];

const ATTACK_STATES = new Set<CharacterState>([
    CharacterState.ATTACKING,
    CharacterState.JAB,
    CharacterState.STRONG_PUNCH,
    CharacterState.WEAK_PUNCH,
    CharacterState.TORNADO_KICK,
    CharacterState.SWEEP_KICK,
]);

interface CharacterProps {
    x: number;
    y: number;
}

export class CharacterController {
    public x: number;
    public y: number;
    public vx: number = 0;
    public vy: number = 0;
    public width: number = 64; // 2x scale of 64px
    public height: number = 64; // 2x scale of 64px
    public state: CharacterState = CharacterState.IDLE;
    public direction: 1 | -1 = 1; // 1 = right, -1 = left
    public animationTimer: number = 0;
    public isGrounded: boolean = false;

    private readonly MOVE_SPEED = 0.05; // Was 0.02
    private readonly JUMP_FORCE = -1.6; // Was -1.0
    private readonly GRAVITY = 0.08;
    private readonly FRICTION = 0.90; // Was 0.85
    private readonly FLOOR_Y = 500;

    public hp: number = 100;
    public maxHp: number = 100;
    public isHit: boolean = false;
    public hitTimer: number = 0;

    // Animation durations (in ticks or ms - we'll use ticks/frames for now)
    private readonly ATTACK_DURATION = 30;

    constructor({ x, y }: CharacterProps) {
        this.x = x;
        this.y = y;
    }

    public takeDamage(amount: number) {
        if (this.hitTimer > 0) return; // Invulnerable
        this.hp -= amount;
        this.hitTimer = 30; // Frames of invulnerability
        // Optional: Knockback?
    }

    public update(input: InputHandler, dt: number, map?: TileMap | null) {
        if (this.hitTimer > 0) this.hitTimer--;

        // If attacking, lock movement and wait for animation to finish
        if (ATTACK_STATES.has(this.state)) {
            this.animationTimer++;
            if (this.animationTimer >= this.ATTACK_DURATION) {
                this.setState(CharacterState.IDLE);
            }
            // Apply gravity and friction even while attacking (can jump attack?)
            // For this simplified version, let's assume grounded attack completely stops x movement
            if (this.y >= this.FLOOR_Y) {
                this.vx *= 0.5; // Strong friction
            } else {
                this.vy += this.GRAVITY; // Still fall if air attacking
            }
        } else {
            this.handleMovement(input);
        }

        if (ATTACK_STATES.has(this.state)) {
            // ... (keep attach logic, but handle physics below)
        } else {
            this.handleMovement(input);
        }

        // Apply Physics (X Axis)
        this.x += this.vx * dt;

        if (map) {
            const hurtbox = this.getHurtbox();
            const collisions = map.getCollisions(hurtbox);
            if (collisions.length > 0) {
                // Simple resolution
                // If moving right, snap to left set of tile
                // If moving left, snap to right side of tile
                // But multiple tiles...

                // Better: Find the deepest penetration or first contact
                // Simplest: Revert X if collision
                // this.x -= this.vx * dt; 
                // this.vx = 0;
                // But we want to slide

                // Let's rely on resolving against the specific tile hit
                // FORCE X Resolution
                const resolutionX = Physics.resolveCollisionX(hurtbox, collisions[0]);
                this.x += resolutionX;
                this.vx = 0;
            }
        }

        // Apply Physics (Y Axis)
        this.y += this.vy * dt;
        this.isGrounded = false; // Reset grounded state, will be set true if collision with floor occurs

        if (map) {
            const hurtbox = this.getHurtbox();
            const collisions = map.getCollisions(hurtbox);
            if (collisions.length > 0) {
                // Assume floor/ceiling
                // FORCE Y Resolution
                const resolutionY = Physics.resolveCollisionY(hurtbox, collisions[0]);
                this.y += resolutionY;

                if (resolutionY < 0) { // Push up = Floor
                    this.isGrounded = true;
                    this.vy = 0;
                } else if (resolutionY > 0) { // Push down = Ceiling
                    this.vy = 0;
                }
            }
        } else {
            // Hardcoded Floor
            if (this.y >= this.FLOOR_Y) {
                this.y = this.FLOOR_Y;
                this.vy = 0;
                this.isGrounded = true;
            }
        }

        if (this.isGrounded) {
            if (this.state === CharacterState.JUMPING) {
                if (Math.abs(this.vx) > 0.1) {
                    this.setState(CharacterState.RUNNING);
                } else {
                    this.setState(CharacterState.IDLE);
                }
            }
        } else {
            // Air state
            if (!ATTACK_STATES.has(this.state) && this.state !== CharacterState.JUMPING) {
                this.setState(CharacterState.JUMPING);
            }
        }

        // Attack triggers
        if (!ATTACK_STATES.has(this.state)) {
            if (input.isDown('KeyJ')) {
                // Random Jab or Weak Punch
                this.setState(Math.random() > 0.5 ? CharacterState.JAB : CharacterState.WEAK_PUNCH);
            } else if (input.isDown('KeyK')) {
                // Random Kick or Tornado
                this.setState(Math.random() > 0.5 ? CharacterState.ATTACKING : CharacterState.TORNADO_KICK);
            } else if (input.isDown('KeyL')) {
                this.setState(CharacterState.STRONG_PUNCH);
            } else if (input.isDown('KeyM')) {
                this.setState(CharacterState.SWEEP_KICK);
            }
        }
    }

    private handleMovement(input: InputHandler) {
        // Horizontal Movement
        if (input.isDown('KeyA')) {
            this.vx -= this.MOVE_SPEED;
            this.direction = -1;
            if (this.state !== CharacterState.JUMPING) this.setState(CharacterState.RUNNING);
        } else if (input.isDown('KeyD')) {
            this.vx += this.MOVE_SPEED;
            this.direction = 1;
            if (this.state !== CharacterState.JUMPING) this.setState(CharacterState.RUNNING);
        } else {
            // Friction
            this.vx *= this.FRICTION;
            if (Math.abs(this.vx) < 0.1) {
                this.vx = 0;
                if (this.state !== CharacterState.JUMPING) this.setState(CharacterState.IDLE);
            }
        }

        // Jumping
        if (input.isDown('Space') && this.isGrounded) {
            this.vy = this.JUMP_FORCE;
            this.setState(CharacterState.JUMPING);
            this.isGrounded = false;
        }

        // Gravity
        this.vy += this.GRAVITY;
    }

    public setState(newState: CharacterState) {
        if (this.state === newState) return;
        this.state = newState;
        this.animationTimer = 0;
    }

    public getHurtbox(): Rectangle {
        // x,y is Bottom-Center (Feet)
        const halfWidth = this.width / 2;
        // Reducing width further (more padding)
        const padding = 24;
        return {
            x: this.x - halfWidth + padding,
            y: this.y - this.height,
            width: this.width - (padding * 2),
            height: this.height
        };
    }

    public getHitbox(): Rectangle | null {
        if (!ATTACK_STATES.has(this.state)) return null;

        // Only active during middle frames
        if (this.animationTimer < 5 || this.animationTimer > 20) return null;

        const range = 2;
        const hitboxHeight = 60;

        // Direction 1 (Right): x is Center. Hitbox should start at Center + Offset
        // Direction -1 (Left): x is Center. Hitbox should start at Center - Range - Offset
        return {
            x: this.direction === 1 ? this.x + 10 : this.x - range - 10,
            y: this.y - hitboxHeight, // Drawn from top-left, so subtract height to "grow up" from feet
            width: range,
            height: hitboxHeight
        };
    }
}
