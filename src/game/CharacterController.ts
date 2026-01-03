import type { InputState } from './InputState';
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
    public characterType: string = 'FRESH'; // Character skin type
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
    public safePosition: { x: number, y: number } = { x: 100, y: 100 };

    private jumpCount: number = 0;
    private readonly MAX_JUMPS: number = 2;
    private canJump: boolean = true; // Requires key release to jump again

    private readonly MOVE_SPEED = 0.0001; // Reduced from 0.003
    private readonly JUMP_FORCE = -1.0; // Reduced from -1.3
    private readonly GRAVITY = 0.005; // Approx 0.08 / 16.67
    private readonly FRICTION = 0.90; // Base friction for 60fps
    private readonly FLOOR_Y = 500;

    public hp: number = 100;
    public maxHp: number = 100;
    public isHit: boolean = false;
    public hitTimer: number = 0; // In ms

    // Animation durations (in ms)
    private readonly ATTACK_DURATION = 500; // 30 frames * 16.67

    constructor({ x, y }: CharacterProps) {
        this.x = x;
        this.y = y;
        this.safePosition = { x, y };
    }

    public takeDamage(amount: number) {
        if (this.hitTimer > 0) return; // Invulnerable
        this.hp -= amount;
        this.hitTimer = 500; // 500ms of invulnerability
        // Optional: Knockback?
    }

    public update(input: InputState, dt: number, map?: TileMap | null) {
        if (this.hitTimer > 0) this.hitTimer -= dt;

        // If attacking, lock movement and wait for animation to finish
        if (ATTACK_STATES.has(this.state)) {
            this.animationTimer += dt;
            if (this.animationTimer >= this.ATTACK_DURATION) {
                this.setState(CharacterState.IDLE);
            }
            // Apply gravity and friction even while attacking (can jump attack?)
            // For this simplified version, let's assume grounded attack completely stops x movement
            if (this.y >= this.FLOOR_Y) {
                // Apply friction scaled by time
                // standard friction is 0.5 per frame for attacking ground?
                // Let's make it strong: 0.01 remains after 100ms
                const frictionFactor = Math.pow(0.5, dt / 16.67);
                this.vx *= frictionFactor;
            } else {
                this.vy += this.GRAVITY * dt; // Still fall if air attacking
            }
        } else {
            this.handleMovement(input, dt);
        }

        // Apply Physics (X Axis)
        this.x += this.vx * dt;

        // Clamp X to Map Bounds
        if (this.x < 0) {
            this.x = 0;
            this.vx = 0;
        } else if (this.x > 7500) { // Slight buffer over win condition
            this.x = 7500;
            this.vx = 0;
        }

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

            // Update Checkpoint if stable grounded
            // Check if standing on solid ground (not falling)
            if (this.vy === 0) {
                this.safePosition = { x: this.x, y: this.y };
            }

            // Reset Jump Count
            if (this.isGrounded && this.vy === 0) {
                this.jumpCount = 0;
            }
        } else {
            // Air state
            if (!ATTACK_STATES.has(this.state) && this.state !== CharacterState.JUMPING) {
                this.setState(CharacterState.JUMPING);
            }
        }

        // Attack triggers
        if (!ATTACK_STATES.has(this.state)) {
            if (input.jab) {
                // Random Jab or Weak Punch
                this.setState(Math.random() > 0.5 ? CharacterState.JAB : CharacterState.WEAK_PUNCH);
            } else if (input.kick) {
                // Random Kick or Tornado
                this.setState(Math.random() > 0.5 ? CharacterState.ATTACKING : CharacterState.TORNADO_KICK);
            } else if (input.heavyPunch) {
                this.setState(CharacterState.STRONG_PUNCH);
            } else if (input.sweep) {
                this.setState(CharacterState.SWEEP_KICK);
            }
        }
    }

    private handleMovement(input: InputState, dt: number) {
        // Horizontal Movement
        let speed = this.MOVE_SPEED;
        if (input.run) {
            speed *= 2;
        }

        if (input.left) {
            this.vx -= speed * dt; // Acceleration scaled by time
            this.direction = -1;
            if (this.state !== CharacterState.JUMPING) this.setState(CharacterState.RUNNING);
        } else if (input.right) {
            this.vx += speed * dt; // Acceleration scaled by time
            this.direction = 1;
            if (this.state !== CharacterState.JUMPING) this.setState(CharacterState.RUNNING);
        } else {
            // Friction scaled by time
            // FRICTION is per-frame factor (0.90)
            const frictionFactor = Math.pow(this.FRICTION, dt / 16.67);
            this.vx *= frictionFactor;

            if (Math.abs(this.vx) < 0.01) { // Threshold reduced for small dt steps
                this.vx = 0;
                if (this.state !== CharacterState.JUMPING) this.setState(CharacterState.IDLE);
            }
        }

        // Jumping
        // Jumping
        const isJumpKeyDown = input.jump;

        if (isJumpKeyDown && this.canJump) {
            if (this.isGrounded) {
                this.vy = this.JUMP_FORCE;
                this.setState(CharacterState.JUMPING);
                this.isGrounded = false;
                this.jumpCount = 1;
                this.canJump = false; // Require release
            } else if (this.jumpCount < this.MAX_JUMPS) {
                // Double Jump
                this.vy = this.JUMP_FORCE; // Full force or reduced? Full force for now.
                this.setState(CharacterState.JUMPING);
                this.jumpCount++;
                this.canJump = false; // Require release
            }
        }

        if (!isJumpKeyDown) {
            this.canJump = true;
        }

        // Gravity
        this.vy += this.GRAVITY * dt;
    }

    public setState(newState: CharacterState) {
        if (this.state === newState) return;
        this.state = newState;
        this.animationTimer = 0;
    }

    public checkVoid(bottomLimit: number) {
        if (this.y > bottomLimit) {
            this.hp -= 20; // Penalty
            this.x = this.safePosition.x; // Reset to Safe Pos
            this.y = this.safePosition.y; // Reset to Safe Pos
            this.vx = 0;
            this.vy = 0;
            return true; // Respawned
        }
        return false;
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

        // Only active during middle frames (approx 83ms to 333ms)
        if (this.animationTimer < 83 || this.animationTimer > 333) return null;

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
