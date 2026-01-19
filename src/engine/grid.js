import { CONFIG } from '../config.js';

export class Grid {
    constructor() {
        this.width = CONFIG.GRID_SIZE;
        this.height = CONFIG.GRID_SIZE;
        this.cells = new Int8Array(this.width * this.height);
        this.metadata = new Array(this.width * this.height).fill(null); // For storing lot/building info

        // Initialize as empty
        this.cells.fill(CONFIG.TYPES.EMPTY);
    }

    getIndex(x, z) {
        if (x < 0 || x >= this.width || z < 0 || z >= this.height) return -1;
        return z * this.width + x;
    }

    getCell(x, z) {
        const index = this.getIndex(x, z);
        if (index === -1) return null;
        return this.cells[index];
    }

    setCell(x, z, type) {
        const index = this.getIndex(x, z);
        if (index === -1) return false;
        this.cells[index] = type;
        return true;
    }

    // Helper to get coordinates from index
    getCoords(index) {
        const x = index % this.width;
        const z = Math.floor(index / this.width);
        return { x, z };
    }
}
