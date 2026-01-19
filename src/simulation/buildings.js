import { CONFIG } from '../config.js';

export class BuildingSystem {
    constructor(grid) {
        this.grid = grid;
    }

    createBuilding(lot, block) {
        // lot.cells = [{x,z}], width, depth, roadDistance

        // Determine type based on proximity to Major Roads
        // For now, we need to know the dist to major road.
        // We can check the edge of the block or just scan neighbors of lot.

        // Simple logic:
        // 50% chance if size > 1

        const type = (Math.random() > 0.5) ? CONFIG.TYPES.BUILDING_RESIDENTIAL : CONFIG.TYPES.BUILDING_COMMERCIAL;

        // Pick varied color
        const color = CONFIG.PALETTE[Math.floor(Math.random() * CONFIG.PALETTE.length)];

        return {
            type: CONFIG.TYPES.BUILDING, // The grid cell type
            subtype: 'residential', // Meta info
            height: 1 + Math.random() * 2,
            cells: lot.cells,
            color: color
        };
    }
}
