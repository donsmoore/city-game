import { CONFIG } from '../config.js';

export class GrowthSystem {
    constructor(grid) {
        this.grid = grid;
        this.timer = 0;
        this.INTERVAL = 5000; // Base: Upgrade check every 5 seconds (was 2s)
    }

    update(deltaTime, speedMultiplier) {
        if (speedMultiplier === 0) return false;

        this.timer += deltaTime * speedMultiplier;
        if (this.timer < this.INTERVAL) return false;

        this.timer = 0;
        let changed = false;

        // 1. Try to Spawn new Buildings (Dynamic Sizing)
        // 10 attempts per tick
        for (let k = 0; k < 10; k++) {
            const x = Math.floor(Math.random() * this.grid.width);
            const z = Math.floor(Math.random() * this.grid.height);

            // Random Size: 1=1x1, 2=1x2 (vert), 3=2x1 (horiz), 4=2x2
            const roll = Math.random();
            let w = 1, d = 1;

            if (roll < 0.5) { w = 1; d = 1; }
            else if (roll < 0.7) { w = 1; d = 2; }
            else if (roll < 0.9) { w = 2; d = 1; }
            else { w = 2; d = 2; }

            if (this.canBuild(x, z, w, d)) {
                this.spawnBuilding(x, z, w, d);
                changed = true;
            }
        }

        // 2. Randomly upgrade existing buildings
        for (let i = 0; i < this.grid.cells.length; i++) {
            if (this.grid.cells[i] === CONFIG.TYPES.BUILDING) {
                if (Math.random() > 0.95) {
                    const meta = this.grid.metadata[i];
                    // Only upgrade root cells
                    if (meta) {
                        const hasAmenities = this.checkAmenities(
                            Math.floor(i % this.grid.width),
                            Math.floor(i / this.grid.width),
                            5
                        );

                        const cap = hasAmenities ? 20 : 10;
                        if (!meta.maxPotential) meta.maxPotential = 10 + Math.random() * 10; // Random potential

                        // Effective max is min(cap, maxPotential) logic? 
                        // User said: "only buildings within 5 tiles of BOTH school and park can grow to max height (20). Others random between 1 and half max (10)."

                        // Strict interpretation:
                        // If hasAmenities: Limit is 20.
                        // If !hasAmenities: Limit is random(1, 10).

                        let limit = 10;
                        if (hasAmenities) limit = 20;
                        else {
                            if (!meta.lowTierLimit) meta.lowTierLimit = Math.floor(1 + Math.random() * 9);
                            limit = meta.lowTierLimit;
                        }

                        if (meta.height < limit) {
                            meta.height += 0.5;
                            changed = true;
                        }
                    }
                }
            }
        }

        return changed; // Return true if re-render needed
    }

    checkAmenities(x, z, radius) {
        let hasPark = false;
        let hasSchool = false;

        const xMin = Math.max(0, x - radius);
        const xMax = Math.min(this.grid.width - 1, x + radius);
        const zMin = Math.max(0, z - radius);
        const zMax = Math.min(this.grid.height - 1, z + radius);

        for (let ix = xMin; ix <= xMax; ix++) {
            for (let iz = zMin; iz <= zMax; iz++) {
                const type = this.grid.getCell(ix, iz);
                if (type === CONFIG.TYPES.PARK) hasPark = true;
                if (type === CONFIG.TYPES.SCHOOL) hasSchool = true;
                if (hasPark && hasSchool) return true;
            }
        }
        return false;
    }

    canBuild(startX, startZ, w, d) {
        // Bounds
        if (startX + w > this.grid.width || startZ + d > this.grid.height) return false;

        // Check Footprint (Must be EMPTY)
        // Check Adjacency (Must touch ROAD)
        let touchesRoad = false;

        for (let x = startX; x < startX + w; x++) {
            for (let z = startZ; z < startZ + d; z++) {
                const type = this.grid.getCell(x, z);
                if (type !== CONFIG.TYPES.EMPTY) return false; // Collision

                // Check neighbors for road
                if (!touchesRoad) {
                    const neighbors = [
                        { x: x + 1, z: z }, { x: x - 1, z: z }, { x: x, z: z + 1 }, { x: x, z: z - 1 }
                    ];
                    for (const n of neighbors) {
                        // Check if neighbor is road
                        if (n.x >= 0 && n.x < this.grid.width && n.z >= 0 && n.z < this.grid.height) {
                            const nt = this.grid.getCell(n.x, n.z);
                            if (nt === CONFIG.TYPES.ROAD_MAJOR || nt === CONFIG.TYPES.ROAD_MINOR) {
                                touchesRoad = true;
                            }
                        }
                    }
                }
            }
        }
        return touchesRoad;
    }

    spawnBuilding(x, z, w, d) {
        const type = (Math.random() > 0.5) ? CONFIG.TYPES.BUILDING_RESIDENTIAL : CONFIG.TYPES.BUILDING_COMMERCIAL;
        const color = CONFIG.PALETTE[Math.floor(Math.random() * CONFIG.PALETTE.length)];

        const cells = [];
        for (let dx = 0; dx < w; dx++) {
            for (let dz = 0; dz < d; dz++) {
                cells.push({ x: x + dx, z: z + dz });
            }
        }

        const buildingMeta = {
            type: CONFIG.TYPES.BUILDING,
            subtype: 'residential',
            height: 1,
            cells: cells,
            color: color
        };

        // Apply
        for (const cell of cells) {
            const idx = this.grid.getIndex(cell.x, cell.z);
            this.grid.cells[idx] = CONFIG.TYPES.BUILDING;

            // Metadata only on root (top-left) for renderer
            if (cell.x === x && cell.z === z) {
                this.grid.metadata[idx] = buildingMeta;
            } else {
                this.grid.metadata[idx] = null;
            }
        }
    }
}
