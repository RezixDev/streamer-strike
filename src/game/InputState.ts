/**
 * Represents the state of input for a single frame.
 * decoupled from DOM KeyboardEvents.
 */
export interface InputState {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    jump: boolean;
    run: boolean;

    // Attacks
    jab: boolean;        // J
    kick: boolean;       // K
    heavyPunch: boolean; // L
    sweep: boolean;      // M
}
