import { CONFIG } from '../config.js';

export class LotGenerator {
    constructor(grid) {
        this.grid = grid;
    }

    generateLots(block) {
        // block.cells is a list of {x,z}
        // Simple algorithm:
        // 1. Identify "Frontier" cells (next to road).
        // 2. Try to form rectangles from them.

        // Even simpler for prototype:
        // Iterate through block cells. 
        // If a cell is next to a road, it's a seed for a Lot.
        // Grow the lot into a square/rectangle if space permits.

        const blockCellsSet = new Set(block.cells.map(c => `${c.x},${c.z}`));
        const consumed = new Set();
        const lots = [];

        // Sort cells by proximity to road? 
        // Actually, just iterating is fine for now.

        for (const cell of block.cells) {
            const key = `${cell.x},${cell.z}`;
            if (consumed.has(key)) continue;

            // Check if adjacent to road
            if (this.isNextToRoad(cell.x, cell.z)) {
                // Start a lot here
                const lot = this.growLot(cell, blockCellsSet, consumed);
                lots.push(lot);
            }
        }

        return lots;
    }

    isNextToRoad(x, z) {
        const neighbors = [
            { x: x + 1, z: z }, { x: x - 1, z: z },
            { x: x, z: z + 1 }, { x: x, z: z - 1 }
        ];

        for (const n of neighbors) {
            // Check bounds? getCell handles it returning null or valid type
            const type = this.grid.getCell(n.x, n.z);
            if (type === CONFIG.TYPES.ROAD_MAJOR || type === CONFIG.TYPES.ROAD_MINOR) {
                return true;
            }
        }
        return false;
    }

    growLot(startCell, blockCellsSet, consumed) {
        // Simple 2x2 or 1x1 or 1x2 growth
        // Let's try to make 2x2 lots if possible, else 1x1

        // Define lot dimensions (sanity check)
        let width = 1;
        let depth = 1;

        // Check 2x2
        // We need (x+1, z), (x, z+1), (x+1, z+1) to be valid and unconsumed
        // But wait, direction matters relative to road.
        // For simplicity: Greedy allocation.

        // Just make 1x1 lots for lowest complexity MVP, then expand.
        // Spec says "Lots are rectangular clusters".
        // Let's try to expand a bit.

        const candidates = [];

        // Try 2x2
        const check2x2 = [
            { x: 0, z: 0 }, { x: 1, z: 0 },
            { x: 0, z: 1 }, { x: 1, z: 1 }
        ];

        let canMake2x2 = true;
        for (let off of check2x2) {
            const tx = startCell.x + off.x;
            const tz = startCell.z + off.z;
            const tKey = `${tx},${tz}`;
            if (!blockCellsSet.has(tKey) || consumed.has(tKey)) {
                canMake2x2 = false;
                break;
            }
        }

        const lotCells = [];

        if (canMake2x2) {
            for (let off of check2x2) {
                const tx = startCell.x + off.x;
                const tz = startCell.z + off.z;
                const tKey = `${tx},${tz}`;
                consumed.add(tKey);
                lotCells.push({ x: tx, z: tz });
            }
            width = 2; depth = 2;
        } else {
            // Fallback 1x1
            consumed.add(`${startCell.x},${startCell.z}`);
            lotCells.push(startCell);
        }

        return {
            cells: lotCells,
            width: width,
            depth: depth,
            // Logic to determine front facing road distance etc.
            roadDistance: 0 // Since we started next to road
        };
    }
}
