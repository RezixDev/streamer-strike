export interface Rectangle {
    x: number;
    y: number;
    width: number;
    height: number;
}

export const Physics = {
    checkCollision: (rect1: Rectangle | null, rect2: Rectangle | null): boolean => {
        if (!rect1 || !rect2) return false;

        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    },

    resolveCollision: (rect1: Rectangle, rect2: Rectangle): { x: number, y: number } => {
        // Returns the translation vector to push rect1 out of rect2
        // Find overlap on X and Y
        const overlapX1 = (rect1.x + rect1.width) - rect2.x;
        const overlapX2 = (rect2.x + rect2.width) - rect1.x;
        const overlapY1 = (rect1.y + rect1.height) - rect2.y;
        const overlapY2 = (rect2.y + rect2.height) - rect1.y;

        // Find smallest overlap
        const minX = Math.min(overlapX1, overlapX2);
        const minY = Math.min(overlapY1, overlapY2);

        // We only care about X axis separation for a side scroller beat 'em up usually
        // But if we want 2D solid, we separate on the axis of least penetration
        // For this game, actors are on the same "floor" Y-wise (mostly), so X separation is key.
        // However, if we only separate X, we might get weird jumps.
        // Let's separate on X only for now as requested "Player shouldn't ghost over enemies"

        if (minX < minY) {
            // Fix X
            if (overlapX1 < overlapX2) {
                return { x: -overlapX1, y: 0 }; // Push Left
            } else {
                return { x: overlapX2, y: 0 }; // Push Right
            }
        } else {
            // Fix Y
            if (overlapY1 < overlapY2) {
                return { x: 0, y: -overlapY1 }; // Push Up
            } else {
                return { x: 0, y: overlapY2 }; // Push Down
            }
        }
        return { x: 0, y: 0 };
    },

    resolveCollisionX: (rect1: Rectangle, rect2: Rectangle): number => {
        const overlapX1 = (rect1.x + rect1.width) - rect2.x;
        const overlapX2 = (rect2.x + rect2.width) - rect1.x;

        // Push Left
        if (overlapX1 < overlapX2) {
            return -overlapX1;
        } else {
            return overlapX2;
        }
    },

    resolveCollisionY: (rect1: Rectangle, rect2: Rectangle): number => {
        const overlapY1 = (rect1.y + rect1.height) - rect2.y;
        const overlapY2 = (rect2.y + rect2.height) - rect1.y;

        // Push Up
        if (overlapY1 < overlapY2) {
            return -overlapY1;
        } else {
            return overlapY2;
        }
    }
};
