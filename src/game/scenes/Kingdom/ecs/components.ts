export type ComponentType = 'position' | 'building' | 'render' | 'armyUnit';

export interface PositionComponent {
    q: number;
    r: number;
}

export interface BuildingComponent {
    buildingId: string; // Reference to BuildingDef
    status: 'constructing' | 'active' | 'upgrading';
    progress: number; // ticks elapsed during construction/upgrade
    upgradeNextId?: string; // id of the next upgrade building, if any
}

export interface RenderComponent {
    // We might store a reference to the Phaser GameObject here, 
    // or just data that the RenderSystem uses to find/create the object.
    // Storing the object directly is easiest for a small game.
    hex: Phaser.GameObjects.Image;
    building?: Phaser.GameObjects.Image; 
    constructionProgress?: Phaser.GameObjects.Graphics;
}

export interface ArmyUnitTrainingState {
    status: 'idle' | 'training';
    progress: number; // ticks elapsed
}

export interface ArmyUnitTrainDef {
    health: number;
    attackDamage: number;
    drFlat: number;
}

export interface ArmyUnitTrainingConfig {
    costBase: Record<string, number>;
    costMult: number;
    time: number; // ticks
    def: ArmyUnitTrainDef;
}

export interface ArmyUnitComponent {
    unitId: string;
    name: string;
    textureId: string;
    assetPath: string;
    speed: number;

    health: number;
    drFlat: number;
    drPercent: number;
    actionsPerTurn: number;

    trainingLevel: number;
    training: ArmyUnitTrainingConfig & ArmyUnitTrainingState;
}
