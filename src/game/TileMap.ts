interface TileData {
    tileId: number;
    flipX: boolean;
}

import { Physics } from './Physics';

interface MapLayer {
    id: string;
    name: string;
    visible: boolean;
    opacity: number;
    data: Record<string, TileData>; // Key is "x,y"
}

export class TileMap {
    private layers: MapLayer[] = [];
    private tileset: HTMLImageElement | null = null;
    private tileSize: number = 32; // Default, can be configured

    constructor(tileSize: number = 32) {
        this.tileSize = tileSize;
    }

    async load(jsonPathOrData: string | any, imagePath?: string): Promise<void> {
        // 1. Load JSON or Use Data
        try {
            if (typeof jsonPathOrData === 'string') {
                const response = await fetch(jsonPathOrData);
                const data = await response.json();
                if (Array.isArray(data)) {
                    this.layers = data;
                } else {
                    this.layers = data.layers;
                }
            } else {
                // Direct data passed
                const data = jsonPathOrData;
                if (Array.isArray(data)) {
                    this.layers = data;
                } else {
                    this.layers = data.layers;
                }
            }
        } catch (e) {
            console.error("Failed to load map JSON:", e);
        }

        // 2. Load Spritesheet (Only if in browser and imagePath provided)
        if (typeof window !== 'undefined' && imagePath) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.src = imagePath;
                img.onload = () => {
                    this.tileset = img;
                    resolve();
                };
                img.onerror = (e) => {
                    console.error("Failed to load tileset image:", e);
                    reject(e);
                };
            });
        } else {
            return Promise.resolve();
        }
    }

    draw(ctx: CanvasRenderingContext2D, cameraX: number, canvasWidth: number, canvasHeight: number) {
        if (!this.tileset) return;

        // Calculate visible range
        const startCol = Math.floor(cameraX / this.tileSize);
        const endCol = startCol + Math.ceil(canvasWidth / this.tileSize) + 1;
        const endRow = Math.ceil(canvasHeight / this.tileSize) + 1;

        this.layers.forEach(layer => {
            if (!layer.visible) return;

            // Skip collision layer for meaningful rendering (unless debug)
            // But usually we don't draw collision layer in final game, 
            // strictly speaking the user might want to see it or not. 
            // For now, let's draw everything that is visible in JSON.

            // Iterate only over visible columns would be efficient if data was 2D array.
            // Since it's a sparse object "x,y", we iterate the object or optimize.
            // For this size (platformer level), iterating all keys might be slow every frame.
            // BETTER: Since keys are "x,y", we just loop x from startCol to endCol and y from 0 to max.

            for (let x = startCol; x <= endCol; x++) {
                // Optimization: Assumption that map isn't infinitely tall. 
                // We scanning, say 0 to 20 (screen height in tiles).
                // Let's assume max height is ~30 tiles (960px).
                for (let y = 0; y < endRow; y++) {
                    const key = `${x},${y}`;
                    const tile = layer.data[key];
                    if (tile) {
                        this.drawTile(ctx, tile.tileId, x * this.tileSize, y * this.tileSize, tile.flipX, layer.opacity);
                    }
                }
            }
        });
    }

    private drawTile(ctx: CanvasRenderingContext2D, tileId: number, destX: number, destY: number, flipX: boolean, opacity: number) {
        if (!this.tileset) return;

        // Assume tileset is a grid. We need to know tileset width in tiles.
        // Let's assume standard layout or strict grid.
        // We usually calculate sourceX/Y from tileId.
        // Standard "Tiled" or similar export: 
        // tileId 0 might be empty or first tile.
        // We need tileset width.
        const tilesetWidthTiles = Math.floor(this.tileset.width / this.tileSize);

        const srcX = (tileId % tilesetWidthTiles) * this.tileSize;
        const srcY = Math.floor(tileId / tilesetWidthTiles) * this.tileSize;

        ctx.globalAlpha = opacity;

        if (flipX) {
            ctx.save();
            ctx.translate(destX + this.tileSize, destY);
            ctx.scale(-1, 1);
            ctx.drawImage(this.tileset, srcX, srcY, this.tileSize, this.tileSize, 0, 0, this.tileSize, this.tileSize);
            ctx.restore();
        } else {
            ctx.drawImage(this.tileset, srcX, srcY, this.tileSize, this.tileSize, destX, destY, this.tileSize, this.tileSize);
        }

        ctx.globalAlpha = 1.0;
    }

    // Returns collision boxes around the given rect
    getCollisions(rect: { x: number, y: number, width: number, height: number }): { x: number, y: number, width: number, height: number }[] {
        const collisions: { x: number, y: number, width: number, height: number }[] = [];

        // Identify range of tiles to check
        const startX = Math.floor(rect.x / this.tileSize);
        const endX = Math.floor((rect.x + rect.width) / this.tileSize);
        const startY = Math.floor(rect.y / this.tileSize);
        const endY = Math.floor((rect.y + rect.height) / this.tileSize);

        // Check specific layers. Usually "Collision" or "Terrain".
        // Check specific layers. Usually "Collision" or "Terrain".
        const collisionLayers = this.layers.filter(l => l.name === 'Collision' || l.name === 'Terrain');

        collisionLayers.forEach(layer => {
            for (let x = startX; x <= endX; x++) {
                for (let y = startY; y <= endY; y++) {
                    const key = `${x},${y}`;
                    if (layer.data[key]) {
                        const tileRect = {
                            x: x * this.tileSize,
                            y: y * this.tileSize,
                            width: this.tileSize,
                            height: this.tileSize
                        };

                        // Strict check: Only return if actually intersecting
                        if (Physics.checkCollision(rect, tileRect)) {
                            collisions.push(tileRect);
                        }
                    }
                }
            }
        });

        return collisions;
    }
}
