import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class VehicleSystem {
    constructor(grid, sceneManager) {
        this.grid = grid;
        this.sceneManager = sceneManager;
        this.vehicles = [];
        this.updateInterval = 0;
        this.spawnTimer = 0;
    }

    update(deltaTime, speedMultiplier, population) {
        this.currentPopulation = population; // Store for spawn logic
        if (speedMultiplier === 0) return;

        // Move Vehicles
        // Speed scaling
        const speed = 2.0 * (deltaTime / 1000) * speedMultiplier;

        for (let i = this.vehicles.length - 1; i >= 0; i--) {
            const v = this.vehicles[i];

            // Move
            v.exactX += v.dir.x * speed;
            v.exactZ += v.dir.z * speed;

            // Update Mesh
            const worldPos = this.gridToWorld(v.exactX, v.exactZ);

            // Right Hand Traffic Offset
            const rightX = -v.dir.z;
            const rightZ = v.dir.x;
            const laneOffset = CONFIG.CELL_SIZE * 0.2; // 2 units offset

            v.mesh.position.set(
                worldPos.x + rightX * laneOffset,
                0.2,
                worldPos.z + rightZ * laneOffset
            );

            // Rotation (Look at direction)
            const angle = Math.atan2(v.dir.x, v.dir.z);
            v.mesh.rotation.y = angle;

            // Check if entered new cell or ready to turn
            const gx = Math.round(v.exactX);
            const gz = Math.round(v.exactZ);

            if (gx !== v.gridX || gz !== v.gridZ) {
                // Entered new cell
                v.gridX = gx;
                v.gridZ = gz;

                // Bounds Check / Despawn
                if (gx < 0 || gx >= this.grid.width || gz < 0 || gz >= this.grid.height) {
                    this.removeVehicle(i);
                    continue;
                }

                const type = this.grid.getCell(gx, gz);
                if (type !== CONFIG.TYPES.ROAD_MAJOR && type !== CONFIG.TYPES.ROAD_MINOR) {
                    // Off road!
                    this.removeVehicle(i);
                    continue;
                }

                // Decision Point: Pick new direction
                const neighbors = [
                    { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }
                ];

                const validDirs = [];
                for (const n of neighbors) {
                    // Don't go back unless dead end
                    if (n.x === -v.dir.x && n.z === -v.dir.z) continue;

                    const nx = gx + n.x;
                    const nz = gz + n.z;

                    // Check map bounds for valid "exit" or road
                    if (nx < 0 || nx >= this.grid.width || nz < 0 || nz >= this.grid.height) {
                        validDirs.push(n);
                        continue;
                    }

                    const nt = this.grid.getCell(nx, nz);
                    if (nt === CONFIG.TYPES.ROAD_MAJOR || nt === CONFIG.TYPES.ROAD_MINOR) {
                        validDirs.push(n);
                    }
                }

                if (validDirs.length > 0) {
                    // Pick random
                    const nextDir = validDirs[Math.floor(Math.random() * validDirs.length)];
                    v.dir = nextDir;
                    // Snap to center to prevent drift
                    v.exactX = gx;
                    v.exactZ = gz;
                } else {
                    // Dead end? Turn back?
                    v.dir = { x: -v.dir.x, z: -v.dir.z };
                }
            }
        }

        // Spawn logic
        if (speedMultiplier > 0) {
            this.spawnTimer += deltaTime * speedMultiplier;
            if (this.spawnTimer > 1000) {
                this.spawnTimer = 0;
                if (this.vehicles.length < 50) {
                    this.spawnVehicle();
                }
            }
        }
    }

    spawnVehicle() {
        // Find edge road
        const edge = Math.floor(Math.random() * 4); // 0: Top, 1: Bottom, 2: Left, 3: Right
        let x, z;
        let dir = { x: 0, z: 0 };

        for (let k = 0; k < 10; k++) {
            if (edge === 0) { x = Math.floor(Math.random() * this.grid.width); z = 0; dir = { x: 0, z: 1 }; }
            else if (edge === 1) { x = Math.floor(Math.random() * this.grid.width); z = this.grid.height - 1; dir = { x: 0, z: -1 }; }
            else if (edge === 2) { x = 0; z = Math.floor(Math.random() * this.grid.height); dir = { x: 1, z: 0 }; }
            else { x = this.grid.width - 1; z = Math.floor(Math.random() * this.grid.height); dir = { x: -1, z: 0 }; }

            const type = this.grid.getCell(x, z);
            if (type === CONFIG.TYPES.ROAD_MAJOR || type === CONFIG.TYPES.ROAD_MINOR) {
                this.addVehicle(x, z, dir);
                return;
            }
        }
    }

    addVehicle(x, z, dir) {
        const mesh = this.createCarMesh();
        const vehicle = {
            gridX: x, gridZ: z,
            exactX: x, exactZ: z,
            spawnX: x, spawnZ: z,
            dir: dir,
            mesh: mesh
        };

        this.sceneManager.scene.add(mesh);
        this.vehicles.push(vehicle);
    }

    removeVehicle(index) {
        const v = this.vehicles[index];
        this.sceneManager.scene.remove(v.mesh);
        this.vehicles.splice(index, 1);
    }

    createCarMesh() {
        const group = new THREE.Group();
        const color = CONFIG.PALETTE[Math.floor(Math.random() * CONFIG.PALETTE.length)];

        // Body (Lowered by 50%)
        const w = CONFIG.CELL_SIZE * 0.3;
        const l = CONFIG.CELL_SIZE * 0.4;
        const h = CONFIG.CELL_SIZE * 0.1; // 50% of previous 0.2

        const bodyGeo = new THREE.BoxGeometry(w, h, l);
        const bodyMat = new THREE.MeshLambertMaterial({ color: color });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = h / 2 + 0.1;
        group.add(body);

        // Cabin (New)
        const cW = w * 0.8;
        const cL = l * 0.5;
        const cH = h * 0.8;
        const cabinGeo = new THREE.BoxGeometry(cW, cH, cL);
        const cabinMat = new THREE.MeshLambertMaterial({ color: 0xcccccc }); // Windows/Grey
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.y = h + 0.1 + cH / 2;
        cabin.position.z = -l * 0.1; // Slightly back
        group.add(cabin);

        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
        const wheelMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        wheelGeo.rotateZ(Math.PI / 2); // Make wheels upright relative to car side

        const offsets = [
            { x: w / 2, z: l / 3 }, { x: -w / 2, z: l / 3 },
            { x: w / 2, z: -l / 3 }, { x: -w / 2, z: -l / 3 }
        ];

        for (const off of offsets) {
            const wMesh = new THREE.Mesh(wheelGeo, wheelMat);
            wMesh.position.set(off.x, 0.3, off.z);
            group.add(wMesh);
        }

        return group;
    }

    gridToWorld(gx, gz) {
        const offset = (CONFIG.GRID_SIZE * CONFIG.CELL_SIZE) / 2;
        const x = (gx * CONFIG.CELL_SIZE) - offset + (CONFIG.CELL_SIZE / 2);
        const z = (gz * CONFIG.CELL_SIZE) - offset + (CONFIG.CELL_SIZE / 2);
        return { x, z };
    }
}
