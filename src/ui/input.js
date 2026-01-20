import { CONFIG } from '../config.js';
import * as THREE from 'three';

export class InputManager {
    constructor(sceneManager, grid, onAction, onPreview) {
        this.sceneManager = sceneManager;
        this.grid = grid;
        this.onAction = onAction;
        this.onPreview = onPreview;
        this.activeTool = 'road_major';

        this.isMouseDown = false;
        this.dragStartGrid = null;

        this.setupEventListeners();
        this.setupToolbar();
    }

    setupEventListeners() {
        const canvas = this.sceneManager.renderer.domElement;

        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.isMouseDown = true;
                if (this.cursorMesh) this.cursorMesh.material.color.setHex(0x00ff00);
                this.handleInput(e, false);
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            if (this.isMouseDown) {
                this.handleInput(e, false);
            }
            this.updateCursor(e);
        });

        canvas.addEventListener('mouseup', (e) => {
            if (this.isMouseDown && e.button === 0) {
                this.handleInput(e, true);
                this.isMouseDown = false;
                this.dragStartGrid = null;
                if (this.cursorMesh) this.cursorMesh.material.color.setHex(0xffffff);
                if (this.onPreview) this.onPreview(null, null, null);
            }
        });
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
        toolbar.innerHTML = '';

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
        let gridPos = null;

        // 1. Try standard Raycast (objects)
        const target = this.sceneManager.raycast(event.clientX, event.clientY);

        if (target) {
            gridPos = this.worldToGrid(target.x, target.z);
        } else {
            // 2. Fallback: Plane Intersection (Y=0) for dragging off-screen
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, this.sceneManager.camera);
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const hit = new THREE.Vector3();

            if (raycaster.ray.intersectPlane(plane, hit)) {
                gridPos = this.worldToGrid(hit.x, hit.z);
                // Clamp to Grid Size
                gridPos.x = Math.max(0, Math.min(CONFIG.GRID_SIZE - 1, gridPos.x));
                gridPos.z = Math.max(0, Math.min(CONFIG.GRID_SIZE - 1, gridPos.z));
            }
        }

        if (!gridPos) return;

        // Standard Bounds check (double check after clamping)
        if (gridPos.x < 0 || gridPos.x >= CONFIG.GRID_SIZE || gridPos.z < 0 || gridPos.z >= CONFIG.GRID_SIZE) return;

        // Straight Line Constraint for Roads
        if (this.isMouseDown && (this.activeTool === 'road_major' || this.activeTool === 'road_minor')) {
            if (!this.dragStartGrid) {
                this.dragStartGrid = gridPos;
            } else {
                const dx = Math.abs(gridPos.x - this.dragStartGrid.x);
                const dz = Math.abs(gridPos.z - this.dragStartGrid.z);
                if (dx > dz) {
                    gridPos.z = this.dragStartGrid.z;
                } else {
                    gridPos.x = this.dragStartGrid.x;
                }
            }
        }

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
            if (isCommit) return;
            if (this.activeTool !== 'road_major' && this.activeTool !== 'road_minor') {
                this.onAction(this.activeTool, gridPos, gridPos);
            }
        }
    }

    updateCursor(event) {
        const target = this.sceneManager.raycast(event.clientX, event.clientY);

        if (!this.cursorMesh) {
            if (this.sceneManager.scene) {
                const geometry = new THREE.BoxGeometry(CONFIG.CELL_SIZE, 0.5, CONFIG.CELL_SIZE);
                const material = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.3, transparent: true });
                this.cursorMesh = new THREE.Mesh(geometry, material);
                this.sceneManager.scene.add(this.cursorMesh);
            }
        }

        let visible = false;
        let gridPos = null;

        if (target) {
            gridPos = this.worldToGrid(target.x, target.z);
            visible = true;
        }

        // Also check if dragging and offscreen? 
        // nah, cursor mesh usually stays on grid.

        if (visible) {
            if (gridPos.x < 0 || gridPos.x >= CONFIG.GRID_SIZE || gridPos.z < 0 || gridPos.z >= CONFIG.GRID_SIZE) {
                visible = false;
            }
        }

        if (!visible && this.cursorMesh) {
            this.cursorMesh.visible = false;
            return;
        }

        if (this.cursorMesh && visible) {
            this.cursorMesh.visible = true;
            const worldPos = this.gridToWorld(gridPos.x, gridPos.z);
            this.cursorMesh.position.set(worldPos.x, 0.5, worldPos.z);
        }
    }
}
