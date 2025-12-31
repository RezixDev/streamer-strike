import type { Rectangle } from './Physics';

export class Enemy {
    public x: number;
    public y: number;
    public width: number = 64;
    public height: number = 64;
    public hp: number = 100;
    public isHit: boolean = false;
    public hitTimer: number = 0;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    public update(dt: number, targetX: number) {
        // Simple AI: Follow player
        if (this.hitTimer > 0) {
            this.hitTimer--;
            this.isHit = this.hitTimer > 0;
            return;
        }

        const distance = targetX - this.x;
        if (Math.abs(distance) > 50) {
             this.x += Math.sign(distance) * 0.01 * dt;
        }
    }

    public takeDamage(amount: number) {
        this.hp -= amount;
        this.isHit = true;
        this.hitTimer = 20; // Stunned for 20 frames
    }

    public getHurtbox(): Rectangle {
        return {
            x: this.x + 10,
            y: this.y + 10,
            width: this.width - 20,
            height: this.height - 20
        };
    }
}
