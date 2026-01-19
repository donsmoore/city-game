import { CONFIG } from '../config.js';

export class BlockManager {
    constructor(grid) {
        this.grid = grid;
        this.blocks = []; // Array of { cells: [{x,z}] }
    }

    // Full regeneration of blocks (Simplest for prototype)
    detectBlocks() {
        const visited = new Int8Array(this.grid.width * this.grid.height).fill(0);
        this.blocks = [];

        for (let z = 0; z < this.grid.height; z++) {
            for (let x = 0; x < this.grid.width; x++) {
                const index = z * this.grid.width + x;
                const type = this.grid.cells[index];

                // If it's a road or special building, skip (boundary)
                if (type === CONFIG.TYPES.ROAD_MAJOR || type === CONFIG.TYPES.ROAD_MINOR ||
                    type === CONFIG.TYPES.PARK || type === CONFIG.TYPES.SCHOOL) {
                    continue;
                }

                // If already visited, skip
                if (visited[index]) continue;

                // Found a new region
                const blockCells = this.floodFill(x, z, visited);
                if (blockCells.length > 0) {
                    this.blocks.push({ cells: blockCells });
                }
            }
        }

        // console.log(\`Detected \${this.blocks.length} blocks\`);
        return this.blocks;
    }

    floodFill(startX, startZ, visited) {
        const cells = [];
        const stack = [{ x: startX, z: startZ }];
        const width = this.grid.width;
        const height = this.grid.height;

        // Mark start as visited immediately
        const startIndex = startZ * width + startX;
        visited[startIndex] = 1;

        while (stack.length > 0) {
            const { x, z } = stack.pop();
            cells.push({ x, z });

            // Check neighbors (4-way)
            const neighbors = [
                { x: x + 1, z: z }, { x: x - 1, z: z },
                { x: x, z: z + 1 }, { x: x, z: z - 1 }
            ];

            for (const n of neighbors) {
                // Bounds check
                if (n.x < 0 || n.x >= width || n.z < 0 || n.z >= height) continue;

                const nIndex = n.z * width + n.x;
                if (visited[nIndex]) continue;

                const nType = this.grid.cells[nIndex];
                if (nType === CONFIG.TYPES.ROAD_MAJOR || nType === CONFIG.TYPES.ROAD_MINOR ||
                    nType === CONFIG.TYPES.PARK || nType === CONFIG.TYPES.SCHOOL) continue;

                visited[nIndex] = 1;
                stack.push(n);
            }
        }

        return cells;
    }
}
