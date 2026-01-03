import { CharacterController } from './CharacterController';
import { Enemy } from './Enemy';
import { Collectible } from './Collectible';
import { TileMap } from './TileMap';
import { Physics } from './Physics';
import type { InputState } from './InputState';
import { CHARACTERS } from './Characters';

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
}
