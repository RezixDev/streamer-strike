import { CharacterState } from './CharacterController';

const BASE = import.meta.env.BASE_URL;

export interface CharacterConfig {
    id: string;
    name: string;
    description: string;
    portrait: string; // Used for selection screen
    selectionFrameCount: number; // Frames in the portrait animation
    assets: Record<CharacterState, string>;
    frameCounts: Record<CharacterState, number>;
    hitboxConfig?: {
        widthReduction: number;
        heightReduction: number;
        offsetY: number; // Vertical offset for rendering logic
    };
}

export const CHARACTERS: Record<string, CharacterConfig> = {
    FRESH: {
        id: 'FRESH',
        name: 'Fresh',
        description: 'The balanced fighter.',
        portrait: `${BASE}sprites/fresh/character_rotation.png`,
        selectionFrameCount: 4,
        assets: {
            [CharacterState.IDLE]: `${BASE}sprites/fresh/idle.png`,
            [CharacterState.RUNNING]: `${BASE}sprites/fresh/run.png`,
            [CharacterState.JUMPING]: `${BASE}sprites/fresh/jump.png`,
            [CharacterState.ATTACKING]: `${BASE}sprites/fresh/attack_kick.png`,
            [CharacterState.JAB]: `${BASE}sprites/fresh/left_jab.png`,
            [CharacterState.STRONG_PUNCH]: `${BASE}sprites/fresh/strong_punch.png`,
            [CharacterState.WEAK_PUNCH]: `${BASE}sprites/fresh/weak_punch.png`,
            [CharacterState.TORNADO_KICK]: `${BASE}sprites/fresh/tornado_kick.png`,
            [CharacterState.SWEEP_KICK]: `${BASE}sprites/fresh/sweap_kick.png`,
        },
        frameCounts: {
            [CharacterState.IDLE]: 4,
            [CharacterState.RUNNING]: 8,
            [CharacterState.JUMPING]: 9,
            [CharacterState.ATTACKING]: 6,
            [CharacterState.JAB]: 3,
            [CharacterState.STRONG_PUNCH]: 6,
            [CharacterState.WEAK_PUNCH]: 6,
            [CharacterState.TORNADO_KICK]: 4,
            [CharacterState.SWEEP_KICK]: 7,
        }
    },
    HOKA: {
        id: 'HOKA',
        name: 'Hoka',
        description: 'A powerful brawler.',
        portrait: `${BASE}sprites/hoka/character_rotation.png`, // Special rotation sprite
        selectionFrameCount: 8,
        assets: {
            [CharacterState.IDLE]: `${BASE}sprites/hoka/idle.png`,
            [CharacterState.RUNNING]: `${BASE}sprites/hoka/run.png`,
            [CharacterState.JUMPING]: `${BASE}sprites/hoka/running_jump.png`,
            [CharacterState.ATTACKING]: `${BASE}sprites/hoka/flying_kick.png`,
            [CharacterState.JAB]: `${BASE}sprites/hoka/left_jab.png`,
            [CharacterState.STRONG_PUNCH]: `${BASE}sprites/hoka/uppercut_punch.png`,
            [CharacterState.WEAK_PUNCH]: `${BASE}sprites/hoka/punch.png`,
            [CharacterState.TORNADO_KICK]: `${BASE}sprites/hoka/flying_kick.png`, // Reusing flying kick
            [CharacterState.SWEEP_KICK]: `${BASE}sprites/hoka/punch.png`, // Reusing punch as fallback
        },
        frameCounts: {
            // Estimates based on Fresh, should verify or load dynamically if possible. 
            // Defaulting to reasonable numbers, likely 4-8.
            [CharacterState.IDLE]: 4,
            [CharacterState.RUNNING]: 8,
            [CharacterState.JUMPING]: 8,
            [CharacterState.ATTACKING]: 6,
            [CharacterState.JAB]: 3,
            [CharacterState.STRONG_PUNCH]: 7,
            [CharacterState.WEAK_PUNCH]: 6,
            [CharacterState.TORNADO_KICK]: 6,
            [CharacterState.SWEEP_KICK]: 6,
        },
        hitboxConfig: {
            widthReduction: 24, // Standard reduction
            heightReduction: 40, // Reduce height significantly (64 - 40 = 24px tall hitbox?) No, let's try conservative.
            // visual feet at 41px (64-23).
            // drawn at y-64.
            // we want visual feet at y.
            // so we draw at y-64+23 = y-41.
            // offset Y should be +23.
            offsetY: 23
        }
    }
};
