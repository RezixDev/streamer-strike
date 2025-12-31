import { Physics, type Rectangle } from './Physics';
import { SpriteRenderer } from './SpriteRenderer';
import { TileMap } from './TileMap';

export type EnemyType = 'SPAMMER' | 'TROLL';
export type EnemyState = 'IDLE' | 'RUN' | 'ATTACK' | 'HIT';

export class Enemy {
    public x: number;
    public y: number;
    public width: number = 64;
    public height: number = 64;
    public hp: number = 100;
    public maxHp: number = 100;
    public type: EnemyType;
    public state: EnemyState = 'IDLE';
    public vy: number = 0;
    private readonly GRAVITY = 0.08;
    private readonly FLOOR_Y = 500; // Fallback

    public isHit: boolean = false;
    public hitTimer: number = 0;
    public attackTimer: number = 0;
    public direction: 1 | -1 = -1; // Default face left

    // Renderer per enemy instance to track own animation frame
    public renderer: SpriteRenderer;

    constructor(x: number, y: number, type: EnemyType) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.renderer = new SpriteRenderer();

        if (type === 'SPAMMER') {
            this.hp = 50;
        } else {
            this.hp = 150;
        }
        this.maxHp = this.hp;
    }

    public update(dt: number, targetX: number, map?: TileMap | null) {
        if (this.hitTimer > 0) {
            this.hitTimer--;
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
                const resolution = Physics.resolveCollision(hurtbox, collisions[0]);
                this.x += resolution.x;
            }
        }

        // Apply Gravity (Y Movement)
        this.vy += this.GRAVITY;
        this.y += this.vy * dt;

        // Resolve Y Collision
        if (map) {
            const hurtbox = this.getHurtbox();
            const collisions = map.getCollisions(hurtbox);
            if (collisions.length > 0) {
                const resolution = Physics.resolveCollision(hurtbox, collisions[0]);
                this.y += resolution.y;
                if (resolution.y < 0) this.vy = 0; // Grounded
            }
        } else {
            // Fallback floor if no map
            if (this.y >= this.FLOOR_Y) {
                this.y = this.FLOOR_Y;
                this.vy = 0;
            }
        }
    }

    private updateSpammer(dt: number, distance: number): number {
        // Spammer Logic: Walks towards player, always
        if (this.attackTimer > 0) {
            this.attackTimer--;
            this.state = 'ATTACK';
            return 0;
        }

        let vx = 0;
        if (Math.abs(distance) < 35) { // Close range
            this.attackTimer = 40;
            this.state = 'ATTACK';
        } else if (Math.abs(distance) > 35) {
            vx = Math.sign(distance) * 0.015;
            this.direction = distance > 0 ? -1 : 1;
            this.state = 'RUN';
        } else {
            this.state = 'IDLE';
        }
        return vx;
    }

    private updateTroll(dt: number, distance: number): number {
        if (this.attackTimer > 0) {
            this.attackTimer--;
            this.state = 'ATTACK';
            return 0;
        }

        let vx = 0;
        if (Math.abs(distance) < 30) {
            this.attackTimer = 60;
            this.state = 'ATTACK';
        } else if (Math.abs(distance) < 400) {
            vx = Math.sign(distance) * 0.01;
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
        this.hitTimer = 20; // Stunned
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
