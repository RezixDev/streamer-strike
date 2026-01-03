import { Physics, type Rectangle } from './Physics';
import { SpriteRenderer } from './SpriteRenderer';
import { TileMap } from './TileMap';

export type EnemyType = 'SPAMMER' | 'TROLL';
export type EnemyState = 'IDLE' | 'RUN' | 'ATTACK' | 'HIT';

export class Enemy {
    public x: number;
    public y: number;
    public width: number = 64;
    public height: number = 64; // 2x scale
    public hp: number = 100;
    public maxHp: number = 100;
    public type: EnemyType;
    public id: string;
    public state: EnemyState = 'IDLE';
    public vy: number = 0;
    private readonly GRAVITY = 0.005; // 0.08 / 16.67
    private readonly FLOOR_Y = 500; // Fallback

    public isHit: boolean = false;
    public hitTimer: number = 0; // ms
    public attackTimer: number = 0; // ms
    public direction: 1 | -1 = -1; // Default face left

    // Renderer per enemy instance to track own animation frame
    public renderer: SpriteRenderer;

    constructor(x: number, y: number, type: EnemyType) {
        this.id = Math.random().toString(36).substr(2, 9);
        this.x = x;
        this.y = y;
        this.type = type;
        if (typeof window !== 'undefined') {
            this.renderer = new SpriteRenderer();
        } else {
            // @ts-ignore
            this.renderer = null;
        }

        if (type === 'SPAMMER') {
            this.hp = 50;
        } else {
            this.hp = 150;
        }
        this.maxHp = this.hp;
    }

    public update(dt: number, targetX: number, map?: TileMap | null) {
        if (this.hitTimer > 0) {
            this.hitTimer -= dt;
            this.isHit = this.hitTimer > 0;
            this.state = 'HIT';
            return;
        }

        const distance = targetX - this.x;

        // Calculate desired X velocity based on AI
        this.direction = distance > 0 ? -1 : 1; // Default facing logic (can be overridden by AI)

        let vx = 0;
        if (this.type === 'TROLL') {
            vx = this.updateTroll(dt, distance);
        } else {
            vx = this.updateSpammer(dt, distance);
        }

        // Apply X Movement
        this.x += vx * dt;

        // Resolve X Collision
        if (map) {
            const hurtbox = this.getHurtbox();
            const collisions = map.getCollisions(hurtbox);
            if (collisions.length > 0) {
                const resolutionX = Physics.resolveCollisionX(hurtbox, collisions[0]);
                this.x += resolutionX;
            }
        }

        // Apply Gravity (Y Movement)
        this.vy += this.GRAVITY * dt;
        this.y += this.vy * dt;

        // Resolve Y Collision
        if (map) {
            const hurtbox = this.getHurtbox();
            const collisions = map.getCollisions(hurtbox);
            if (collisions.length > 0) {
                const resolutionY = Physics.resolveCollisionY(hurtbox, collisions[0]);
                this.y += resolutionY;
                if (resolutionY < 0) this.vy = 0; // Grounded
            }
        } else {
            // Fallback floor if no map
            if (this.y >= this.FLOOR_Y) {
                this.y = this.FLOOR_Y;
                this.vy = 0;
            }
        }
    }

    private updateSpammer(_dt: number, distance: number): number {
        // Spammer Logic: Walks towards player, always
        if (this.attackTimer > 0) {
            this.attackTimer -= _dt;
            this.state = 'ATTACK';
            return 0;
        }

        let vx = 0;
        if (Math.abs(distance) < 35) { // Close range
            this.attackTimer = 667; // 40 frames * 16.67
            this.state = 'ATTACK';
        } else if (Math.abs(distance) > 35) {
            // 0.015 per frame => 0.0009 per ms
            vx = Math.sign(distance) * 0.0009;
            this.direction = distance > 0 ? -1 : 1;
            this.state = 'RUN';
        } else {
            this.state = 'IDLE';
        }
        return vx;
    }

    private updateTroll(_dt: number, distance: number): number {
        if (this.attackTimer > 0) {
            this.attackTimer -= _dt;
            this.state = 'ATTACK';
            return 0;
        }

        let vx = 0;
        if (Math.abs(distance) < 30) {
            this.attackTimer = 1000; // 60 frames * 16.67
            this.state = 'ATTACK';
        } else if (Math.abs(distance) < 400) {
            // 0.01 per frame => 0.0006 per ms
            vx = Math.sign(distance) * 0.0006;
            this.direction = distance > 0 ? -1 : 1;
            this.state = 'RUN';
        } else {
            this.state = 'IDLE';
        }
        return vx;
    }

    public takeDamage(amount: number) {
        this.hp -= amount;
        this.isHit = true;
        this.hitTimer = 333; // 20 frames -> 333ms
    }

    public getHurtbox(): Rectangle {
        // x,y is Bottom-Center
        const halfWidth = this.width / 2;
        return {
            x: this.x - halfWidth + 10,
            y: this.y - this.height + 5,
            width: this.width - 20,
            height: this.height - 10
        };
    }
}
