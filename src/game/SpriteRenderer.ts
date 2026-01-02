export class SpriteRenderer {
    // Speed of animation in ms per frame
    // Defaulting to 100ms (10fps) which is roughly 6 frames at 60fps
    private msPerFrame: number = 100;
    private timer: number = 0;
    private currentFrame: number = 0;

    // Map states to spritesheets or row indices
    // For now, let's assume we pass the specific image for the current state to the draw function
    // or we can store a map here.

    public draw(
        ctx: CanvasRenderingContext2D,
        image: HTMLImageElement | null,
        x: number,
        y: number,
        width: number,
        height: number,
        direction: 1 | -1,
        frameCount: number, // Total frames in this sprite strip
        dt: number
    ) {
        if (!image || !image.complete || image.naturalWidth === 0) {
            // Fallback rectangle
            ctx.fillStyle = 'red';
            ctx.fillRect(x - width / 2, y - height, width, height);
            return;
        }

        this.timer += dt;
        if (this.timer > this.msPerFrame) {
            this.timer = 0;
            this.currentFrame = (this.currentFrame + 1) % frameCount;
        }

        // Reset frame if it goes out of bounds (when switching animations)
        if (this.currentFrame >= frameCount) {
            this.currentFrame = 0;
        }

        ctx.save();
        // Translate to the character's position to handle flipping correctly
        ctx.translate(x, y);

        // Flip if facing left
        ctx.scale(direction, 1);

        // Draw the sprite
        // Assuming spritesheet is a horizontal strip
        const frameWidth = image.width / frameCount;
        const frameHeight = image.height;

        // Draw centered horizontally, bottom-aligned vertically to (x, y)
        // Destination X is -frameWidth/2 because we translated to x
        // Destination Y is -frameHeight because we want y to be the feet
        ctx.drawImage(
            image,
            this.currentFrame * frameWidth, 0, frameWidth, frameHeight,
            -frameWidth / 2, -frameHeight, frameWidth, frameHeight
        );

        ctx.restore();
    }

    public resetAnimation() {
        this.currentFrame = 0;
        this.timer = 0;
    }
}
