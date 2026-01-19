import { BlockManager } from './block.js';
import { LotGenerator } from './lot.js';
import { BuildingSystem } from './buildings.js';
import { CONFIG } from '../config.js';

export class SimulationManager {
    constructor(grid) {
        this.grid = grid;
        this.blockManager = new BlockManager(grid);
        this.lotGenerator = new LotGenerator(grid);
        this.buildingSystem = new BuildingSystem(grid);
    }

    // Call this when infrastructure changes
    updateTopology() {
        // 1. Clear existing lots/buildings from grid 
        // (In a real game we would be smarter, but for prototype we regenerate non-locked areas)
        // this.clearRegeneratable();

        // 2. Detect Blocks
        // const blocks = this.blockManager.detectBlocks();

        // 3. Generate Lots & Buildings
        // for (const block of blocks) {
        //     const lots = this.lotGenerator.generateLots(block);
        //     for (const lot of lots) {
        //         for (const cell of lot.cells) {
        //             this.grid.setCell(cell.x, cell.z, CONFIG.TYPES.LOT);
        //             const index = this.grid.getIndex(cell.x, cell.z);
        //             this.grid.metadata[index] = {
        //                 type: 'lot',
        //                 lotRef: lot,
        //                 cells: lot.cells
        //             };
        //         }
        //     }
        // }
    }

    clearRegeneratable() {
        // Disabled for now as we don't have pre-defined lots
        /*
        for (let i = 0; i < this.grid.cells.length; i++) {
            const type = this.grid.cells[i];
            if (type === CONFIG.TYPES.LOT || type === CONFIG.TYPES.BUILDING) {
                this.grid.cells[i] = CONFIG.TYPES.EMPTY;
                this.grid.metadata[i] = null;
            }
        }
        */
    }
}
