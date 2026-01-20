import { SceneManager } from './render/scene.js';
import { CameraController } from './render/view.js';
import { Grid } from './engine/grid.js';
import { InputManager } from './ui/input.js';
import { SimulationManager } from './simulation/sim.js';
import { GrowthSystem } from './simulation/growth.js';
import { VehicleSystem } from './simulation/vehicles.js';
import { ModelFactory } from './render/models.js';
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
                if (meta) { // Root only
                    // Height 1 = ~10 people. Height 5 = ~50 people per cell
                    // But larger lots = more people.
                    // Simply: height * 50
                    pop += Math.floor(meta.height * 50);
                }
            }
        }
        document.getElementById('pop-display').innerText = `Pop: ${pop}`;
    }

    handlePreview(tool, start, end) {
        // Clear previous previews
        this.previewMeshes.forEach(mesh => this.sceneManager.scene.remove(mesh));
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
                } else if (tool === 'road_minor') {
                    if (currentType !== CONFIG.TYPES.ROAD_MINOR && currentType !== CONFIG.TYPES.ROAD_MAJOR) {
                        this.grid.setCell(x, z, CONFIG.TYPES.ROAD_MINOR);
                        this.grid.metadata[this.grid.getIndex(x, z)] = { type: 'road_minor' };
                        changed = true;
                    }
                } else if (tool === 'park') {
                    if (currentType !== CONFIG.TYPES.PARK && currentType !== CONFIG.TYPES.ROAD_MAJOR) {
                        this.grid.setCell(x, z, CONFIG.TYPES.PARK);
                        this.grid.metadata[this.grid.getIndex(x, z)] = { type: 'park' };
                        changed = true;
                    }
                } else if (tool === 'school') {
                    if (currentType !== CONFIG.TYPES.SCHOOL && currentType !== CONFIG.TYPES.ROAD_MAJOR) {
                        this.grid.setCell(x, z, CONFIG.TYPES.SCHOOL);
                        this.grid.metadata[this.grid.getIndex(x, z)] = { type: 'school' };
                        changed = true;
                    }
                } else if (tool === 'delete') {
                    if (currentType !== CONFIG.TYPES.EMPTY) {
                        this.grid.setCell(x, z, CONFIG.TYPES.EMPTY);
                        this.grid.metadata[this.grid.getIndex(x, z)] = null;
                        changed = true;
                    }
                }
            }
        }

        if (changed) {
            // Update visuals for the placed/removed cell immediately?
            // Or wait for sim update? 
            // Better to trigger Sim update which might change MANY cells.
            this.simManager.updateTopology();
            this.syncVisuals();
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

        // Check compatibility
        if (existing) {
            if (existing.userData.type === type) {
                // Additional checks for buildings
                if (type === CONFIG.TYPES.BUILDING) {
                    if (meta && existing.userData.height === meta.height && existing.userData.subtype === meta.subtype) {
                        return; // No change needed
                    }
                } else {
                    return; // No change needed for static types
                }
            }
            // If mismatch, remove existing
            this.sceneManager.scene.remove(existing);
            this.cellMeshes.delete(key);
        }

        // If Empty, we are done
        if (type === CONFIG.TYPES.EMPTY) return;

        let mesh;

        if (type === CONFIG.TYPES.BUILDING) {
            if (meta) {
                // It is a root cell
                let w = 1, d = 1;
                if (meta.cells) {
                    // Calculate w/d from cells bounding box
                    const xs = meta.cells.map(c => c.x);
                    const zs = meta.cells.map(c => c.z);
                    w = Math.max(...xs) - Math.min(...xs) + 1;
                    d = Math.max(...zs) - Math.min(...zs) + 1;
                }

                mesh = ModelFactory.createBuildingMesh(meta, w, d);

                // Position correction
                // Pivot is usually center of first cell? No, usually corner or center relative to 0,0.
                // We shift it later.

                if (w > 1 || d > 1) {
                    // Center the mesh in the multi-cell area
                    // Base position is center of cell (x,z)
                    // Box is size w*10, d*10.
                    // We need to shift by (w-1)*5, (d-1)*5
                    mesh.translateX((w - 1) * CONFIG.CELL_SIZE / 2);
                    mesh.translateZ((d - 1) * CONFIG.CELL_SIZE / 2);
                }
            } else {
                return;
            }
        } else if (type === CONFIG.TYPES.ROAD_MAJOR || type === CONFIG.TYPES.ROAD_MINOR) {
            // ... (Road creation logic same as before, abbreviated here if not changing)
            // Re-copying full logic to ensure safety
            mesh = new THREE.Group();
            let h = 0.1;
            const geometry = new THREE.BoxGeometry(CONFIG.CELL_SIZE, h, CONFIG.CELL_SIZE);
            const material = new THREE.MeshLambertMaterial({ color: 0x111111 });
            const road = new THREE.Mesh(geometry, material);
            mesh.add(road);

            // Determine Orientation checking neighbors
            let connectedX = false;
            let connectedZ = false;

            // Helper to check if neighbor is road
            const isRoad = (nx, nz) => {
                if (nx < 0 || nx >= this.grid.width || nz < 0 || nz >= this.grid.height) return false;
                const t = this.grid.getCell(nx, nz);
                return (t === CONFIG.TYPES.ROAD_MAJOR || t === CONFIG.TYPES.ROAD_MINOR);
            };

            if (isRoad(x - 1, z) || isRoad(x + 1, z)) connectedX = true;
            if (isRoad(x, z - 1) || isRoad(x, z + 1)) connectedZ = true;

            // Default: Z-axis (Vertical) if connectedZ or isolated
            // If connectedX and NOT connectedZ -> Rotate 90
            // If Both (Intersection) -> Maybe no lines or Cross? 
            // User asked for Lines. 
            // Simple rule: If Horizontal dominance, rotate.

            let rotation = -Math.PI / 2; // Default for Plane (Vertical strip)

            if (connectedX && !connectedZ) {
                rotation = 0; // Horizontal strip (Plane default is Z-up, so rotated X -90 makes it flat Z-aligned. Wait.)
                // PlaneGeometry (width, height). Facing +Z.
                // Rotate X -90 -> Flat on XZ plane. "Height" becomes Z-length. "Width" is X-length.
                // If geometry is (5, 1). 5 is Width (X), 1 is Height (Z).
                // So default is Horizontal bar `=====`.
                // Previous code: lines.rotation.x = -Math.PI / 2;
                // It looked "vertical" or "horizontal"?
                // User said: "bottom right to top left... proper orientation". 
                // That sounds like Vertical (along Z) or Horizontal (along X) depending on view?
                // Let's assume default geometry (w, h) aligns with X.
                // If we want Z alignment, we rotate 90 deg around Y.
            }

            // Re-eval geometry:
            // PlaneGeometry(CONFIG.CELL_SIZE * 0.5, CONFIG.CELL_SIZE * 0.1);
            // Width = 5 (Large), Height = 1 (Thin). 
            // Placed flat: It's a bar along X axis.
            // If connectedZ (Vertical road), we want bar along Z axis. -> Rotate Y 90.
            // If connectedX (Horizontal road), we want bar along X axis. -> No Y rotation.

            const lGeo = new THREE.PlaneGeometry(CONFIG.CELL_SIZE * 0.5, CONFIG.CELL_SIZE * 0.1);
            const lMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const lines = new THREE.Mesh(lGeo, lMat);
            lines.position.y = 0.06;

            // Base flat rotation
            lines.rotation.x = -Math.PI / 2;

            // Directional rotation
            // If Z-connected (Vertical Road) -> Rotate to align Z
            // If X-connected (Horizontal Road) -> Align X (Default)

            // Prioritize Z connection for logic?
            // If road is drawn "bottom left to top right" (diagonal?? No grid is orthogonal).
            // User likely means "Vertical on screen" vs "Horizontal".

            // If I draw a line along Z (Vertical), neighbors are Z-1, Z+1. connectedZ=true. connectedX=false.
            // I want vertical stripe. Geometry is wide X. So I need 90 deg rotation.

            if (connectedZ && !connectedX) {
                lines.rotation.z = Math.PI / 2;
            } else if (connectedX && !connectedZ) {
                // Keep default (Aligned X)
            } else if (connectedX && connectedZ) {
                // Intersection. Draw nothing or Cross?
                // Let's skip lines for intersection to look clean
                lines.visible = false;
            } else {
                // Isolated dot or single cell. Default to something?
                // Let's default to Z alignment if ambiguous?
                // Or visible=false?
            }

            mesh.add(lines);

            // Hide dot if intersection?
            // User didn't ask about dots. Keeping them.
            const dGeo = new THREE.PlaneGeometry(1, 1);
            const dMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const dot = new THREE.Mesh(dGeo, dMat);
            dot.rotation.x = -Math.PI / 2;
            dot.position.y = 0.06;
            mesh.add(dot);

        } else if (type === CONFIG.TYPES.LOT) {
            const geometry = new THREE.PlaneGeometry(CONFIG.CELL_SIZE, CONFIG.CELL_SIZE);
            const material = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.LOT_GRASS });
            mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = -Math.PI / 2;
        } else if (type === CONFIG.TYPES.PARK) {
            mesh = new THREE.Group();
            const gGeo = new THREE.CylinderGeometry(CONFIG.CELL_SIZE * 0.4, CONFIG.CELL_SIZE * 0.4, 0.2, 8);
            const gMat = new THREE.MeshLambertMaterial({ color: 0x2d4c1e });
            const base = new THREE.Mesh(gGeo, gMat);
            base.position.y = 0.1;
            mesh.add(base);
            const tGeo = new THREE.CylinderGeometry(CONFIG.CELL_SIZE * 0.05, CONFIG.CELL_SIZE * 0.05, 1.5, 6);
            const tMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
            const trunk = new THREE.Mesh(tGeo, tMat);
            trunk.position.y = 0.75;
            mesh.add(trunk);
            const lGeo = new THREE.ConeGeometry(CONFIG.CELL_SIZE * 0.3, 2, 8);
            const lMat = new THREE.MeshLambertMaterial({ color: 0x1e5927 });
            const leaves = new THREE.Mesh(lGeo, lMat);
            leaves.position.y = 1.8;
            mesh.add(leaves);

        } else if (type === CONFIG.TYPES.SCHOOL) {
            const geometry = new THREE.BoxGeometry(CONFIG.CELL_SIZE * 0.8, 1, CONFIG.CELL_SIZE * 0.8);
            const material = new THREE.MeshLambertMaterial({ color: 0xffff00 });
            mesh = new THREE.Mesh(geometry, material);
            mesh.position.y = 0.5;
        }

        if (mesh) {
            // Tag mesh with data for future checks
            mesh.userData = { type: type };
            if (meta) {
                mesh.userData.height = meta.height;
                mesh.userData.subtype = meta.subtype;
            }

            const worldPos = this.inputManager.gridToWorld(x, z);
            mesh.position.x += worldPos.x;
            mesh.position.z += worldPos.z;

            if (mesh.geometry && mesh.geometry.type === 'PlaneGeometry') mesh.position.y = 0.05;
            else if (type !== CONFIG.TYPES.BUILDING) mesh.position.y = 0.05;

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
