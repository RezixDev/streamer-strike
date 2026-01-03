import type { InputState } from './InputState';

export class InputHandler {
    public keys: Set<string>;

    constructor() {
        this.keys = new Set();
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', this.handleKeyDown);
            window.addEventListener('keyup', this.handleKeyUp);
        }
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        this.keys.add(e.code);
    };

    private handleKeyUp = (e: KeyboardEvent) => {
        this.keys.delete(e.code);
    };

    public isDown(code: string): boolean {
        return this.keys.has(code);
    }

    public getState(): InputState {
        return {
            left: this.isDown('KeyA'),
            right: this.isDown('KeyD'),
            up: this.isDown('KeyW'),
            down: this.isDown('KeyS'),
            jump: this.isDown('Space'),
            run: this.isDown('KeyN'),
            jab: this.isDown('KeyJ'),
            kick: this.isDown('KeyK'),
            heavyPunch: this.isDown('KeyL'),
            sweep: this.isDown('KeyM')
        };
    }

    public destroy() {
        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', this.handleKeyDown);
            window.removeEventListener('keyup', this.handleKeyUp);
        }
    }
}
