import { CONFIG } from '../config.js';
import * as THREE from 'three';

export class InputManager {
    constructor(sceneManager, grid, onAction, onPreview) {
        this.sceneManager = sceneManager;
        this.grid = grid;
        this.onAction = onAction; // Callback for commit (tool, start, end)
        this.onPreview = onPreview; // Callback for ghost (tool, start, end)
        this.activeTool = 'road_major';

        this.isMouseDown = false;
        this.dragStartGrid = null;

        this.setupEventListeners();
        this.setupToolbar();
    }

    setupEventListeners() {
        // Interaction on canvas
        const canvas = this.sceneManager.renderer.domElement;

        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click
                this.isMouseDown = true;
                if (this.cursorMesh) this.cursorMesh.material.color.setHex(0x00ff00); // Green
                this.handleInput(e, false); // Preview only
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            if (this.isMouseDown) {
                this.handleInput(e, false); // Preview
            }
            this.updateCursor(e);
        });

        canvas.addEventListener('mouseup', (e) => {
            if (this.isMouseDown && e.button === 0) {
                this.handleInput(e, true); // Commit
                this.isMouseDown = false;
                this.dragStartGrid = null; // Reset constraint
                if (this.cursorMesh) this.cursorMesh.material.color.setHex(0xffffff); // White release

                // Clear preview on release
                if (this.onPreview) this.onPreview(null, null, null);
            }
        });

        // Add pan/zoom listeners later (right click or scroll)
    }

    setupToolbar() {
        const tools = [
            { id: 'road_major', label: 'Major Road' },
            { id: 'road_minor', label: 'Minor Road' },
            { id: 'park', label: 'Park' },
            { id: 'school', label: 'School' },
            { id: 'delete', label: 'Bulldoze' }
        ];

        const toolbar = document.getElementById('toolbar');
        toolbar.innerHTML = ''; // Clear

        tools.forEach(tool => {
            const btn = document.createElement('button');
            btn.className = 'tool-btn';
            if (tool.id === this.activeTool) btn.classList.add('active');
            btn.innerText = tool.label;
            btn.onclick = () => {
                this.activeTool = tool.id;
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
            toolbar.appendChild(btn);
        });
    }

    gridToWorld(gx, gz) {
        const offset = (CONFIG.GRID_SIZE * CONFIG.CELL_SIZE) / 2;
        const x = (gx * CONFIG.CELL_SIZE) - offset + (CONFIG.CELL_SIZE / 2);
        const z = (gz * CONFIG.CELL_SIZE) - offset + (CONFIG.CELL_SIZE / 2);
        return { x, z };
    }

    worldToGrid(x, z) {
        const offset = (CONFIG.GRID_SIZE * CONFIG.CELL_SIZE) / 2;
        const gx = Math.floor((x + offset) / CONFIG.CELL_SIZE);
        const gz = Math.floor((z + offset) / CONFIG.CELL_SIZE);
        return { x: gx, z: gz };
    }

    handleInput(event, isCommit) {
        const target = this.sceneManager.raycast(event.clientX, event.clientY);
        if (!target) return;

        let gridPos = this.worldToGrid(target.x, target.z);

        // Bounds check
        if (gridPos.x < 0 || gridPos.x >= CONFIG.GRID_SIZE || gridPos.z < 0 || gridPos.z >= CONFIG.GRID_SIZE) return;

        // Straight Line Constraint for Roads
        // Only valid if we have a start point
        if (this.isMouseDown && (this.activeTool === 'road_major' || this.activeTool === 'road_minor')) {
            if (!this.dragStartGrid) {
                this.dragStartGrid = gridPos; // Set start
            } else {
                const dx = Math.abs(gridPos.x - this.dragStartGrid.x);
                const dz = Math.abs(gridPos.z - this.dragStartGrid.z);

                if (dx > dz) {
                    gridPos.z = this.dragStartGrid.z; // Lock Z, move X
                } else {
                    gridPos.x = this.dragStartGrid.x; // Lock X, move Z
                }
            }
        }

        // If not a road tool, start and end are same (single cell action usually)
        // But for dragging bulldozers etc we might want range too. 
        // For simplicity: Roads use drag range. Others use repeated single cells?
        // User requested drag commit for ROADS.

        let start = gridPos;
        let end = gridPos;

        if (this.activeTool === 'road_major' || this.activeTool === 'road_minor') {
            start = this.dragStartGrid || gridPos;
            end = gridPos;

            if (isCommit) {
                this.onAction(this.activeTool, start, end);
            } else {
                this.onPreview(this.activeTool, start, end);
            }
        } else {
            // For other tools (place single item), maybe commit immediately on mousedown?
            // "Ghost" for single item is just the cursor.
            // But strict requirement: "Ghost road until finished".

            // If we drag delete, that's fine to keep as is? 
            // "Misses some tiles" implies valid drag for everything is nice.
            // Let's uniform it: Drag = Preview, Release = Commit for everything?
            // Park/School are point-click. Dragging them spawns many?
            // Let's keep Park/School as point click (commit on mousedown for immediate feedback).
            // But Roads use the new flow.

            if (isCommit) return; // Don't re-do on mouse up for single click tools if we did on down

            // Actually, best internal logic:
            // Roads: Commit on Up. Preview on Down/Move.
            // Others: Commit on Down/Move (Paint mode). Preview cursor only.

            if (this.activeTool !== 'road_major' && this.activeTool !== 'road_minor') {
                // Paint mode (immediate)
                this.onAction(this.activeTool, gridPos, gridPos);
            }
        }
    }

    updateCursor(event) {
        const target = this.sceneManager.raycast(event.clientX, event.clientY);

        // Lazy initialization of cursor mesh
        if (!this.cursorMesh) {
            // Check if scene exists
            if (this.sceneManager.scene) {
                const geometry = new THREE.BoxGeometry(CONFIG.CELL_SIZE, 0.5, CONFIG.CELL_SIZE);
                const material = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.3, transparent: true });
                this.cursorMesh = new THREE.Mesh(geometry, material);
                this.sceneManager.scene.add(this.cursorMesh);
            }
        }

        if (!target) {
            if (this.cursorMesh) this.cursorMesh.visible = false;
            return;
        }

        const gridPos = this.worldToGrid(target.x, target.z);

        // Bounds check
        if (gridPos.x < 0 || gridPos.x >= CONFIG.GRID_SIZE || gridPos.z < 0 || gridPos.z >= CONFIG.GRID_SIZE) {
            if (this.cursorMesh) this.cursorMesh.visible = false;
            return;
        }

        if (this.cursorMesh) {
            this.cursorMesh.visible = true;
            const worldPos = this.gridToWorld(gridPos.x, gridPos.z);
            this.cursorMesh.position.set(worldPos.x, 0.5, worldPos.z);
        }
    }
}
