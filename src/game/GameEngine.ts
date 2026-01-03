import { CharacterController } from './CharacterController';
import { Enemy } from './Enemy';
import { Collectible } from './Collectible';
import { TileMap } from './TileMap';
import { Physics } from './Physics';
import type { InputState } from './InputState';
import { CHARACTERS } from './Characters';
import type { GameState, CharacterNetworkState, EnemyState, CollectibleState } from './NetworkTypes';

export class GameEngine {
    public players: Map<string, CharacterController> = new Map();
    public enemies: Enemy[] = [];
    public collectibles: Collectible[] = [];
    public tileMap: TileMap;
    public gameOver: boolean = false;
    public gameWon: boolean = false;

    // Callbacks for events (optional, for UI)
    public onDamage?: (damage: number) => void;
    public onScore?: (score: number) => void;

    private readonly BASE = (import.meta as any).env?.BASE_URL || '/';

    constructor(initialMapData?: any) {
        // Initialize TileMap
        this.tileMap = new TileMap(64);

        if (initialMapData) {
            // Server-side or Pre-loaded usage
            this.tileMap.load(initialMapData);
        } else if (typeof window !== 'undefined') {
            // Client-side auto-load
            this.tileMap.load(`${this.BASE}sprites/maps/arena/arena.json`, `${this.BASE}sprites/maps/map_spritesheet.png`);
        }

        // Spawn Enemies
        this.initLevel();
    }

    private initLevel() {
        this.enemies = [];
        this.collectibles = [];
        this.enemies.push(new Enemy(800, 100, 'SPAMMER'));
        this.enemies.push(new Enemy(1200, 100, 'TROLL'));
        this.enemies.push(new Enemy(1600, 100, 'SPAMMER'));
    }

    public addPlayer(id: string, characterType: string = 'FRESH') {
        const player = new CharacterController({ x: 250, y: 300 });
        player.characterType = characterType;
        this.players.set(id, player);
    }

    public removePlayer(id: string) {
        this.players.delete(id);
    }

    public update(dt: number, inputs: Record<string, InputState>) {
        if (this.gameOver || this.gameWon) return;

        // Update All Players
        this.players.forEach((player, id) => {
            const input = inputs[id];
            if (input) {
                player.update(input, dt, this.tileMap);
                player.checkVoid(2000); // Void check

                // Collectibles
                this.collectibles = this.collectibles.filter(c => {
                    if (!c.collected && Physics.checkCollision(player.getHitbox(), c)) {
                        c.collected = true;
                        if (this.onScore) this.onScore(100);
                        // Heal
                        if (c.type === 'HEART') {
                            player.hp = Math.min(player.maxHp, player.hp + 20);
                        }
                        return false;
                    }
                    return true;
                });
            }
        });

        // Update Enemies
        // Target usually the closest player
        this.enemies.forEach(enemy => {
            // Find closest player
            let closestX = 0;
            let minDist = Infinity;

            if (this.players.size > 0) {
                for (const [_, p] of this.players) {
                    const dist = Math.abs(p.x - enemy.x);
                    if (dist < minDist) {
                        minDist = dist;
                        closestX = p.x;
                    }
                }
            } else {
                closestX = enemy.x; // Stay still
            }

            enemy.update(dt, closestX, this.tileMap);

            // Check Collisions with ALL players
            if (!enemy.isHit) {
                this.players.forEach(player => {
                    // Enemy Attack
                    if (enemy.state === 'ATTACK') {
                        let attackRange = 0;
                        if (enemy.type === 'SPAMMER' && enemy.attackTimer > 167 && enemy.attackTimer < 500) {
                            attackRange = 40;
                        } else if (enemy.type === 'TROLL' && enemy.attackTimer > 333 && enemy.attackTimer < 667) {
                            attackRange = 60;
                        }

                        if (attackRange > 0) {
                            const attackHitbox = {
                                x: enemy.direction === -1 ? enemy.x + 20 : enemy.x - 20 - attackRange,
                                y: enemy.y - 40,
                                width: attackRange,
                                height: 40
                            };

                            if (Physics.checkCollision(attackHitbox, player.getHurtbox())) {
                                if (player.hitTimer === 0) {
                                    player.takeDamage(10);
                                    if (this.onDamage) this.onDamage(10);
                                    console.log("Player Hit by", enemy.type);
                                }
                            }
                        }
                    }

                    // Player Hit Enemy
                    if (player.state === 'JAB' || player.state === 'KICK' || player.state === 'HEAVY_PUNCH') {
                        if (Physics.checkCollision(player.getHitbox(), enemy.getHurtbox())) {
                            enemy.takeDamage(10);
                            if (this.onScore) this.onScore(10);
                        }
                    }

                    // Body Collision
                    const playerHurtbox = player.getHurtbox();
                    const enemyHurtbox = enemy.getHurtbox();
                    if (Physics.checkCollision(enemyHurtbox, playerHurtbox)) {
                        const resolution = Physics.resolveCollision(playerHurtbox, enemyHurtbox);
                        player.x += resolution.x;
                        player.y += resolution.y;
                    }
                });
            }
        });

        // Check Game Over (if all players are dead)
        if (this.players.size > 0 && Array.from(this.players.values()).every(p => p.hp <= 0) && !this.gameOver) {
            this.gameOver = true;
        }

        // Win Condition
        if (this.players.size > 0 && Array.from(this.players.values()).some(p => p.x > 7400) && !this.gameWon) {
            this.gameWon = true;
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
        const playersSnapshot: Record<string, CharacterNetworkState> = {};
        this.players.forEach((p, id) => {
            playersSnapshot[id] = {
                characterType: p.characterType,
                x: p.x,
                y: p.y,
                vx: p.vx,
                vy: p.vy,
                hp: p.hp,
                maxHp: p.maxHp,
                state: p.state,
                direction: p.direction,
                isGrounded: p.isGrounded,
                isHit: p.isHit
            };
        });

        return {
            players: playersSnapshot,
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
            gameOver: this.gameOver, // This might need to be player-specific? For now global game over?
            gameWon: this.gameWon
        };
    }

    public applySnapshot(state: GameState) {
        // Sync Players
        // 1. Remove players present locally but not in snapshot
        for (const id of this.players.keys()) {
            if (!state.players[id]) {
                this.players.delete(id);
            }
        }

        // 2. Add or Update players
        Object.entries(state.players).forEach(([id, pState]) => {
            let player = this.players.get(id);
            if (!player) {
                player = new CharacterController({ x: pState.x, y: pState.y });
                this.players.set(id, player);
            }

            player.characterType = pState.characterType;
            player.x = pState.x;
            player.y = pState.y;
            player.vx = pState.vx;
            player.vy = pState.vy;
            player.hp = pState.hp;
            player.state = pState.state as any;
            player.direction = pState.direction as 1 | -1;
            player.isGrounded = pState.isGrounded;
            player.isHit = pState.isHit;
        });

        // Enemies
        // Sync enemies list logic (Same as before)
        const newEnemies: Enemy[] = [];
        state.enemies.forEach(eState => {
            let enemy = this.enemies.find(e => e.id === eState.id);
            if (!enemy) {
                enemy = new Enemy(eState.x, eState.y, eState.type as any);
                enemy.id = eState.id;
            }
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
        this.collectibles = state.collectibles.map(c => {
            const col = new Collectible(c.x, c.y, c.type as any);
            col.collected = c.collected;
            return col;
        });

        this.gameOver = state.gameOver;
        this.gameWon = state.gameWon;
    }
}
