import { SceneManager } from './render/scene.js';
import { CameraController } from './render/view.js';
import { Grid } from './engine/grid.js';
import { InputManager } from './ui/input.js';
import { SimulationManager } from './simulation/sim.js';
import { GrowthSystem } from './simulation/growth.js';
import { VehicleSystem } from './simulation/vehicles.js';
import { ModelFactory } from './render/models.js';
import { disposeObject } from './render/utils.js';
import { CONFIG } from './config.js';
import * as THREE from 'three';

class Game {
    constructor() {
        this.grid = new Grid();
        this.sceneManager = new SceneManager();
        this.cameraController = new CameraController(this.sceneManager.camera, this.sceneManager.renderer.domElement);
        this.simManager = new SimulationManager(this.grid);
        this.growthSystem = new GrowthSystem(this.grid);
        this.vehicleSystem = new VehicleSystem(this.grid, this.sceneManager);
        this.inputManager = new InputManager(
            this.sceneManager,
            this.grid,
            this.handleAction.bind(this),
            this.handlePreview.bind(this)
        );

        this.cellMeshes = new Map();
        this.previewMeshes = []; // Ghost meshes

        // Time System
        this.simSpeed = 1;
        this.years = 1;
        this.days = 1;
        this.population = 0;
        this.dayAccumulator = 0;
        this.DAY_LENGTH = 1000; // 1 second per day at 1x speed

        this.lastTime = performance.now();

        this.setupSpeedControls();

        // Start Loop
        this.animate();
    }

    setupSpeedControls() {
        const buttons = document.querySelectorAll('.speed-btn');
        buttons.forEach(btn => {
            btn.onclick = () => {
                this.simSpeed = parseInt(btn.dataset.speed);
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
        });
    }

    updateTime(deltaTime) {
        if (this.simSpeed === 0) return;

        this.dayAccumulator += deltaTime * this.simSpeed;

        while (this.dayAccumulator >= this.DAY_LENGTH) {
            this.dayAccumulator -= this.DAY_LENGTH;
            this.days++;
            if (this.days > 365) {
                this.days = 1;
                this.years++;
            }
            this.updateTimeUI();
        }
    }

    updateTimeUI() {
        document.getElementById('time-display').innerText = `Year: ${this.years} | Day: ${this.days}`;
    }

    updatePopulation() {
        // Simple metric: Count building heights
        let pop = 0;
        for (let i = 0; i < this.grid.cells.length; i++) {
            if (this.grid.cells[i] === CONFIG.TYPES.BUILDING) {
                const meta = this.grid.metadata[i];
                if (meta && meta.isPivot) { // Root only
                    // Height 1 = ~10 people. Height 5 = ~50 people per cell
                    // But larger lots = more people.
                    // Simply: height * 50 * (width * depth)
                    const w = meta.width || 1;
                    const d = meta.depth || 1;
                    pop += Math.floor(meta.height * 50 * w * d);
                }
            }
        }
        this.population = pop;
        document.getElementById('pop-display').innerText = `Pop: ${pop}`;
    }

    handlePreview(tool, start, end) {
        // Clear previous previews
        this.previewMeshes.forEach(mesh => {
            disposeObject(mesh);
            this.sceneManager.scene.remove(mesh);
        });
        this.previewMeshes = [];

        if (!tool || !start || !end) return;

        // Iterate range
        const xMin = Math.min(start.x, end.x);
        const xMax = Math.max(start.x, end.x);
        const zMin = Math.min(start.z, end.z);
        const zMax = Math.max(start.z, end.z);

        const color = (tool === 'road_major') ? 0x000000 : 0x333333;

        for (let x = xMin; x <= xMax; x++) {
            for (let z = zMin; z <= zMax; z++) {
                const geometry = new THREE.BoxGeometry(CONFIG.CELL_SIZE, 0.2, CONFIG.CELL_SIZE);
                const material = new THREE.MeshBasicMaterial({ color: color, opacity: 0.5, transparent: true });
                const mesh = new THREE.Mesh(geometry, material);

                const worldPos = this.inputManager.gridToWorld(x, z);
                mesh.position.set(worldPos.x, 0.2, worldPos.z);
                this.sceneManager.scene.add(mesh);
                this.previewMeshes.push(mesh);
            }
        }
    }

    handleAction(tool, start, end) {
        let changed = false;

        // Handle single inputs (x, z passed as simple numbers in old calls, or obj in new)
        // Compatibility: InputManager now always passes objects {x,z} or numbers?
        // Logic check: InputManager was refactored.
        // If 'start' is number, it's legacy or paint mode single cell.
        // Actually InputManager paint mode logic: onAction(tool, gridPos, gridPos) -> objects.

        // Defensive check
        let xMin, xMax, zMin, zMax;

        if (typeof start === 'number') { xMin = xMax = start; zMin = zMax = end; }
        else {
            xMin = Math.min(start.x, end.x);
            xMax = Math.max(start.x, end.x);
            zMin = Math.min(start.z, end.z);
            zMax = Math.max(start.z, end.z);
        }

        for (let x = xMin; x <= xMax; x++) {
            for (let z = zMin; z <= zMax; z++) {
                const currentType = this.grid.getCell(x, z);

                if (tool === 'road_major') {
                    if (currentType !== CONFIG.TYPES.ROAD_MAJOR) {
                        this.grid.setCell(x, z, CONFIG.TYPES.ROAD_MAJOR);
                        this.grid.metadata[this.grid.getIndex(x, z)] = { type: 'road_major' };
                        changed = true;
                    }
                } else if (tool.startsWith('park')) {
                    // Multi-tile handling
                    let w = 1, d = 1;
                    const parts = tool.split(':');
                    if (parts.length === 3) {
                        w = parseInt(parts[1]);
                        d = parseInt(parts[2]);
                    }

                    // Check if whole footprint is valid
                    let canPlace = true;
                    for (let px = 0; px < w; px++) {
                        for (let pz = 0; pz < d; pz++) {
                            const tx = x + px;
                            const tz = z + pz;
                            if (tx >= this.grid.width || tz >= this.grid.height) { canPlace = false; break; }
                            const t = this.grid.getCell(tx, tz);
                            if (t !== CONFIG.TYPES.EMPTY && t !== CONFIG.TYPES.LOT) { canPlace = false; break; }
                        }
                        if (!canPlace) break;
                    }

                    if (canPlace) {
                        for (let px = 0; px < w; px++) {
                            for (let pz = 0; pz < d; pz++) {
                                const tx = x + px;
                                const tz = z + pz;
                                const isPivot = (px === 0 && pz === 0);
                                this.grid.setCell(tx, tz, CONFIG.TYPES.PARK);
                                this.grid.metadata[this.grid.getIndex(tx, tz)] = {
                                    type: 'park',
                                    width: w,
                                    depth: d,
                                    isPivot: isPivot,
                                    rootX: x,
                                    rootZ: z
                                };
                            }
                        }
                        changed = true;
                    }
                } else if (tool === 'school') {
                    if (currentType !== CONFIG.TYPES.SCHOOL && currentType !== CONFIG.TYPES.ROAD_MAJOR) {
                        this.grid.setCell(x, z, CONFIG.TYPES.SCHOOL);
                        this.grid.metadata[this.grid.getIndex(x, z)] = { type: 'school' };
                        changed = true;
                    }
                } else if (tool === 'hospital') {
                    if (currentType !== CONFIG.TYPES.HOSPITAL && currentType !== CONFIG.TYPES.ROAD_MAJOR) {
                        this.grid.setCell(x, z, CONFIG.TYPES.HOSPITAL);
                        this.grid.metadata[this.grid.getIndex(x, z)] = { type: 'hospital' };
                        changed = true;
                    }
                } else if (tool === 'fire_station') {
                    if (currentType !== CONFIG.TYPES.FIRE_STATION && currentType !== CONFIG.TYPES.ROAD_MAJOR) {
                        this.grid.setCell(x, z, CONFIG.TYPES.FIRE_STATION);
                        this.grid.metadata[this.grid.getIndex(x, z)] = { type: 'fire_station' };
                        changed = true;
                    }
                } else if (tool === 'delete') {
                    if (currentType !== CONFIG.TYPES.EMPTY) {
                        const meta = this.grid.metadata[this.grid.getIndex(x, z)];
                        if (meta && meta.rootX !== undefined && meta.rootZ !== undefined) {
                            // Smart delete for multi-tile objects
                            const rw = meta.width || 1;
                            const rd = meta.depth || 1;
                            const rx = meta.rootX;
                            const rz = meta.rootZ;
                            for (let dx = 0; dx < rw; dx++) {
                                for (let dz = 0; dz < rd; dz++) {
                                    const tx = rx + dx;
                                    const tz = rz + dz;
                                    this.grid.setCell(tx, tz, CONFIG.TYPES.EMPTY);
                                    this.grid.metadata[this.grid.getIndex(tx, tz)] = null;
                                }
                            }
                        } else {
                            // Simple delete
                            this.grid.setCell(x, z, CONFIG.TYPES.EMPTY);
                            this.grid.metadata[this.grid.getIndex(x, z)] = null;
                        }
                        changed = true;
                    }
                }
            }
        }

        if (changed) {
            this.simManager.updateTopology();

            // Optimization: instead of full sync, we could update only range + neighbors
            // For now, full sync is okay but let's at least ensure neighbors of roads are updated
            if (tool === 'road_major' || tool === 'delete') {
                for (let x = xMin - 1; x <= xMax + 1; x++) {
                    for (let z = zMin - 1; z <= zMax + 1; z++) {
                        if (x >= 0 && x < this.grid.width && z >= 0 && z < this.grid.height) {
                            this.updateCellVisual(x, z);
                        }
                    }
                }
            } else {
                this.syncVisuals();
            }
        }
    }

    syncVisuals() {
        // Iterate through all grid cells and update meshes if needed
        // Optimized: Only update changed cells? 
        // For prototype, we can diff or just brutally check everything if grid is small (40x40 = 1600 checks, fine).

        for (let z = 0; z < this.grid.height; z++) {
            for (let x = 0; x < this.grid.width; x++) {
                this.updateCellVisual(x, z);
            }
        }
    }

    updateCellVisual(x, z) {
        const type = this.grid.getCell(x, z);
        const key = `${x},${z}`;
        const existing = this.cellMeshes.get(key);
        const index = this.grid.getIndex(x, z);
        const meta = this.grid.metadata[index];

        // Optimization: Handle early exits for unchanged meshes
        if (existing && existing.userData.type === type) {
            if (type === CONFIG.TYPES.BUILDING) {
                if (meta && existing.userData.height === meta.height) return;
            } else if (type === CONFIG.TYPES.ROAD_MAJOR || type === CONFIG.TYPES.ROAD_MINOR) {
                // FALL THROUGH: specialized road logic below handles cx/cz check
            } else {
                return; // Static type (Parks, Hospital, etc)
            }
        }

        // If types differ, we MUST dispose before proceeding
        if (existing && existing.userData.type !== type) {
            disposeObject(existing);
            this.sceneManager.scene.remove(existing);
            this.cellMeshes.delete(key);
        }

        if (type === CONFIG.TYPES.EMPTY) return;

        let mesh;
        let cx, cz;

        if (type === CONFIG.TYPES.BUILDING) {
            if (meta && meta.isPivot) {
                let w = meta.width || 1;
                let d = meta.depth || 1;
                mesh = ModelFactory.createBuildingMesh(meta, w, d);
                // Center for multi-tile
                if (w > 1 || d > 1) {
                    mesh.translateX((w - 1) * CONFIG.CELL_SIZE / 2);
                    mesh.translateZ((d - 1) * CONFIG.CELL_SIZE / 2);
                }
            } else return;
        } else if (type === CONFIG.TYPES.ROAD_MAJOR || type === CONFIG.TYPES.ROAD_MINOR) {
            const isRoad = (nx, nz) => {
                const t = this.grid.getCell(nx, nz);
                return (t === CONFIG.TYPES.ROAD_MAJOR || t === CONFIG.TYPES.ROAD_MINOR);
            };
            cx = isRoad(x - 1, z) || isRoad(x + 1, z);
            cz = isRoad(x, z - 1) || isRoad(x, z + 1);

            // Optimization: Skip if same connectivity
            if (existing && existing.userData.type === type &&
                existing.userData.cx === cx && existing.userData.cz === cz) {
                return;
            }

            if (existing) {
                disposeObject(existing);
                this.sceneManager.scene.remove(existing);
                this.cellMeshes.delete(key);
            }

            mesh = ModelFactory.createRoadMesh(type, cx, cz);
        } else if (type === CONFIG.TYPES.LOT) {
            const geometry = new THREE.PlaneGeometry(CONFIG.CELL_SIZE, CONFIG.CELL_SIZE);
            const material = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.LOT_GRASS });
            mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = -Math.PI / 2;
        } else if (type === CONFIG.TYPES.PARK) {
            if (meta && meta.isPivot) {
                mesh = ModelFactory.createParkMesh(meta.width || 1, meta.depth || 1);
            } else return;
        } else if (type === CONFIG.TYPES.SCHOOL) {
            mesh = ModelFactory.createSchoolMesh();
        } else if (type === CONFIG.TYPES.HOSPITAL) {
            mesh = ModelFactory.createHospitalMesh();
        } else if (type === CONFIG.TYPES.FIRE_STATION) {
            mesh = ModelFactory.createFireStationMesh();
        }

        if (mesh) {
            mesh.userData = {
                type: type,
                height: meta ? meta.height : 0,
                cx: cx,
                cz: cz
            };
            const worldPos = this.inputManager.gridToWorld(x, z);
            mesh.position.x += worldPos.x;
            mesh.position.z += worldPos.z;

            // Adjust height for non-building meshes to sit slightly above ground
            if (type !== CONFIG.TYPES.BUILDING) {
                if (mesh.isGroup) {
                    // Groups don't have position.y adjustment the same way always, but 0.05 is safe for base
                    mesh.position.y = 0; // Use object's internal offsets
                } else {
                    mesh.position.y = 0.05;
                }
            } else {
                mesh.position.y = 0;
            }

            this.sceneManager.scene.add(mesh);
            this.cellMeshes.set(key, mesh);
        }
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        const now = performance.now();
        const deltaTime = now - this.lastTime;
        this.lastTime = now;

        this.updateTime(deltaTime);

        if (this.growthSystem.update(deltaTime, this.simSpeed)) {
            this.syncVisuals();
            this.updatePopulation();
        }

        // Update Traffic
        // ensure this.population exists. It is set in updatePopulation which is called on init?
        // updatePopulation sets document text. Does it set this.population? 
        this.vehicleSystem.update(deltaTime, this.simSpeed, this.population || 0);

        this.sceneManager.render();
    }
}

// Start Game
window.game = new Game();
