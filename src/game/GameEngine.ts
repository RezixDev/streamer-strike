import { CharacterController } from './CharacterController';
import { Enemy } from './Enemy';
import { Collectible } from './Collectible';
import { TileMap } from './TileMap';
import { Physics } from './Physics';
import type { InputState } from './InputState';
import { CHARACTERS } from './Characters';
import type { GameState, CharacterNetworkState, EnemyState, CollectibleState } from './NetworkTypes';

export class GameEngine {
    public character: CharacterController;
    public enemies: Enemy[] = [];
    public collectibles: Collectible[] = [];
    public tileMap: TileMap;
    public gameOver: boolean = false;
    public gameWon: boolean = false;

    // Callbacks for events (optional, for UI)
    public onDamage?: (damage: number) => void;
    public onScore?: (score: number) => void;

    private readonly BASE = (import.meta as any).env?.BASE_URL || '/';

    constructor(characterId: string = 'FRESH', mapData?: any) {
        // Initialize Character
        this.character = new CharacterController({ x: 100, y: 100 });

        // Initialize TileMap
        this.tileMap = new TileMap(64);

        if (mapData) {
            // Server-side or Pre-loaded usage
            this.tileMap.load(mapData);
        } else if (typeof window !== 'undefined') {
            // Client-side auto-load
            this.tileMap.load(`${this.BASE}sprites/maps/level1/map_data_level1.json`, `${this.BASE}sprites/maps/map_spritesheet.png`);
        }


        // Spawn Enemies
        this.enemies = []; // Start empty
        this.collectibles = [];
    }

    public update(dt: number, input: InputState) {
        if (this.gameOver || this.gameWon) return;

        // Update Character (Refactored method signature needed!)
        // Casting input for now until CharacterController is refactored
        this.character.update(input, dt, this.tileMap);

        this.character.checkVoid(1000);

        // Update Enemies
        this.enemies.forEach(enemy => {
            enemy.update(dt, this.character.x, this.tileMap);
        });

        // Check Collision: Player Attack vs Enemy
        const hitbox = this.character.getHitbox();
        if (hitbox) {
            this.enemies.forEach(enemy => {
                if (!enemy.isHit) {
                    const hurtbox = enemy.getHurtbox();
                    if (Physics.checkCollision(hitbox, hurtbox)) {
                        enemy.takeDamage(10);
                        console.log("HIT Enemy!", enemy.type);
                    }
                }
            });
        }

        // Check Collision: Enemy Attack vs Player & Body Collision
        const playerHurtbox = this.character.getHurtbox();
        this.enemies.forEach(enemy => {
            const enemyHurtbox = enemy.getHurtbox();

            // Solid Collision (Body vs Body)
            if (Physics.checkCollision(enemyHurtbox, playerHurtbox)) {
                const resolution = Physics.resolveCollision(playerHurtbox, enemyHurtbox);
                this.character.x += resolution.x;
                this.character.y += resolution.y;
            }

            // Enemy Attack Damage
            let attackRange = 0;
            if (enemy.state === 'ATTACK') {
                if (enemy.type === 'SPAMMER' && enemy.attackTimer > 167 && enemy.attackTimer < 500) {
                    attackRange = 40;
                } else if (enemy.type === 'TROLL' && enemy.attackTimer > 333 && enemy.attackTimer < 667) {
                    attackRange = 60;
                }
            }

            if (attackRange > 0) {
                const attackHitbox = {
                    x: enemy.direction === -1 ? enemy.x + 20 : enemy.x - 20 - attackRange,
                    y: enemy.y - 40,
                    width: attackRange,
                    height: 40
                };

                if (Physics.checkCollision(attackHitbox, playerHurtbox)) {
                    if (this.character.hitTimer === 0) {
                        this.character.takeDamage(10);
                        if (this.onDamage) this.onDamage(10);
                        console.log("Player Hit by", enemy.type);
                    }
                }
            }
        });

        // Check Game Over
        if (this.character.hp <= 0 && !this.gameOver) {
            this.gameOver = true;
        }

        // Check Collectible Collisions
        this.collectibles.forEach(collectible => {
            if (!collectible.collected && Physics.checkCollision(playerHurtbox, collectible.getHitbox())) {
                collectible.collected = true;
                this.character.hp = Math.min(this.character.maxHp, this.character.hp + 20);
                console.log("Collected Heart! HP:", this.character.hp);
            }
        });

        // Remove collected collectibles
        this.collectibles = this.collectibles.filter(c => !c.collected);

        // Check Win Condition
        if (this.character.x > 7400 && !this.gameWon) {
            this.gameWon = true;
        }

        // Random Spawning logic
        if (this.enemies.length < 5 && Math.random() < 0.01) {
            const spawnX = this.character.x + 600 + Math.random() * 400;
            const type = Math.random() > 0.7 ? 'TROLL' : 'SPAMMER';
            this.enemies.push(new Enemy(spawnX, 100, type));
        }

        // Remove dead enemies & Drop Collectibles
        this.enemies = this.enemies.filter(enemy => {
            if (enemy.hp <= 0) {
                if (Math.random() < 0.5) {
                    this.collectibles.push(new Collectible(enemy.x, enemy.y - 32, 'HEART'));
                }
                return false;
            }
            return true;
        });
    }

    public getSnapshot(): GameState {
        return {
            character: {
                x: this.character.x,
                y: this.character.y,
                vx: this.character.vx,
                vy: this.character.vy,
                hp: this.character.hp,
                maxHp: this.character.maxHp,
                state: this.character.state,
                direction: this.character.direction,
                isGrounded: this.character.isGrounded,
                isHit: this.character.isHit
            },
            enemies: this.enemies.map(e => ({
                id: e.id,
                type: e.type,
                x: e.x,
                y: e.y,
                hp: e.hp,
                maxHp: e.maxHp,
                state: e.state,
                direction: e.direction,
                isHit: e.isHit
            })),
            collectibles: this.collectibles.map(c => ({
                type: c.type,
                x: c.x,
                y: c.y,
                width: c.width,
                height: c.height,
                collected: c.collected
            })),
            gameOver: this.gameOver,
            gameWon: this.gameWon
        };
    }

    public applySnapshot(state: GameState) {
        // Character
        this.character.x = state.character.x;
        this.character.y = state.character.y;
        this.character.vx = state.character.vx;
        this.character.vy = state.character.vy;
        this.character.hp = state.character.hp;
        this.character.state = state.character.state as any; // Cast back to enum/union
        this.character.direction = state.character.direction as 1 | -1;
        this.character.isGrounded = state.character.isGrounded;
        this.character.isHit = state.character.isHit;

        // Enemies
        // Simple sync: Rebuild array or update existing?
        // For Phase 3, full rebuild might be easier but less efficient.
        // Let's try to update existing by ID if possible to preserve renderer state?
        // Actually renderer is mostly stateless except for animation timer which is reset on state change.
        // But if we create NEW Enemy instances, we lose the renderer state unless we copy it.
        // BUT: Clientside GameEngine doesn't really run update() logic for enemies, just renders.

        // Better approach for visualization:
        // Sync enemies list.
        const newEnemies: Enemy[] = [];
        state.enemies.forEach(eState => {
            let enemy = this.enemies.find(e => e.id === eState.id);
            if (!enemy) {
                // New Enemy
                enemy = new Enemy(eState.x, eState.y, eState.type as any);
                enemy.id = eState.id;
            }
            // Update
            enemy.x = eState.x;
            enemy.y = eState.y;
            enemy.hp = eState.hp;
            enemy.state = eState.state as any;
            enemy.direction = eState.direction as 1 | -1;
            enemy.isHit = eState.isHit;
            newEnemies.push(enemy);
        });
        this.enemies = newEnemies;

        // Collectibles
        // Naive rebuild for now
        this.collectibles = state.collectibles.map(c => {
            const col = new Collectible(c.x, c.y, c.type as any);
            col.collected = c.collected;
            return col;
        });

        this.gameOver = state.gameOver;
        this.gameWon = state.gameWon;
    }
}
