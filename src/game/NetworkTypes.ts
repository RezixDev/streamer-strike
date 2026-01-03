export interface EnemyState {
    id: string;
    type: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    state: string; // EnemyState string union
    direction: number;
    isHit: boolean;
}

export interface CharacterNetworkState {
    characterType: string; // 'FRESH', 'HOKA', etc.
    x: number;
    y: number;
    vx: number;
    vy: number;
    hp: number;
    maxHp: number;
    state: string; // CharacterState string union
    direction: number;
    isGrounded: boolean;
    isHit: boolean;
}

export interface CollectibleState {
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    collected: boolean;
}

export interface GameState {
    players: Record<string, CharacterNetworkState>;
    enemies: EnemyState[];
    collectibles: CollectibleState[];
    gameOver: boolean;
    gameWon: boolean;
}
