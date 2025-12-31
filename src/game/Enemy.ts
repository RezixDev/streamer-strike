import type { Rectangle } from './Physics';
import { SpriteRenderer } from './SpriteRenderer';

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

    public update(dt: number, targetX: number) {
        if (this.hitTimer > 0) {
            this.hitTimer--;
            this.isHit = this.hitTimer > 0;
            this.state = 'HIT';
            return;
        }

        const distance = targetX - this.x;
        // If distance > 0 (Player is right), we want face Right.
        // If sprites are inherently Left: Left (normal) is 1? No usually Right is normal.
        // Let's assume sprites face Right by default.
        // If distance > 0 (Right), direction should be 1.
        // If "Enemies are facing wrong direction", maybe they face Left by default?
        // Or maybe my scale logic is backwards.
        // Renderer: ctx.scale(direction, 1);
        // If direction is 1, scale(1, 1) -> No flip.
        // If direction is -1, scale(-1, 1) -> Flip.

        // If user says "Wrong direction", and I was doing:
        // this.direction = distance > 0 ? 1 : -1;
        // Then when Player is Right (dist > 0), dir is 1 (No Flip).
        // If sprite faces Right, it looks Right. Correct.
        // If sprite faces Left, it looks Left. Wrong (should look Right).

        // Let's try inverting it if the sprites are indeed facing Left by default or logic was just wrong.
        this.direction = distance > 0 ? -1 : 1;

        if (this.type === 'TROLL') {
            this.updateTroll(dt, distance);
        } else {
            this.updateSpammer(dt, distance);
        }
    }

    private updateSpammer(dt: number, distance: number) {
        // Spammer Logic: Walks towards player, always
        if (this.attackTimer > 0) {
            this.attackTimer--;
            this.state = 'ATTACK';
            return;
        }

        if (Math.abs(distance) < 35) { // Close range (Collision is ~64)
            this.attackTimer = 40; // Faster attack than Troll
            this.state = 'ATTACK';
        } else if (Math.abs(distance) > 35) {
            this.x += Math.sign(distance) * 0.015 * dt;
            this.state = 'RUN';
        } else {
            this.state = 'IDLE';
        }
    }

    private updateTroll(dt: number, distance: number) {
        // Troll Logic: Walks, attacks when close
        if (this.attackTimer > 0) {
            this.attackTimer--;
            this.state = 'ATTACK';
            return;
        }

        if (Math.abs(distance) < 30) { // Slightly longer range
            // Attack range
            this.attackTimer = 60; // Cooldown/Duration
            this.state = 'ATTACK';
        } else if (Math.abs(distance) < 400) {
            // Chase range
            this.x += Math.sign(distance) * 0.01 * dt;
            this.state = 'RUN';
        } else {
            this.state = 'IDLE';
        }
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
