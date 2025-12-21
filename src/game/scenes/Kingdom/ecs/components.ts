export type ComponentType = 'position' | 'building' | 'render';

export interface PositionComponent {
    q: number;
    r: number;
}

export interface BuildingComponent {
    buildingId: string; // Reference to BuildingDef
    status: 'constructing' | 'active';
    progress: number; // ms elapsed
}

export interface RenderComponent {
    // We might store a reference to the Phaser GameObject here, 
    // or just data that the RenderSystem uses to find/create the object.
    // Storing the object directly is easiest for a small game.
    hex: Phaser.GameObjects.Image;
    building?: Phaser.GameObjects.Image; 
    constructionProgress?: Phaser.GameObjects.Graphics;
}

export interface Entity {
    id: string;
    position: PositionComponent;
    building?: BuildingComponent;
    render?: RenderComponent;
}
