import type { Rectangle } from './Physics';

export type CollectibleType = 'HEART';

export class Collectible {
    public x: number;
    public y: number;
    public width: number = 32;
    public height: number = 32;
    public type: CollectibleType;
    public collected: boolean = false;

    constructor(x: number, y: number, type: CollectibleType) {
        this.x = x;
        this.y = y;
        this.type = type;
    }

    public getHitbox(): Rectangle {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}
