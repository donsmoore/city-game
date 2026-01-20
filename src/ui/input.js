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
        this.lastValidGrid = null;

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

        window.addEventListener('mousemove', (e) => {
            if (this.isMouseDown) {
                this.handleInput(e, false);
            }
            this.updateCursor(e);
        });

        window.addEventListener('mouseup', (e) => {
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
        // Yellow Bulldozer SVG
        const bulldozerSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f1c40f" width="24px" height="24px">
            <path d="M0 0h24v24H0z" fill="none"/>
            <path d="M19.57 7.78c-.76-2.58-1.55-4.58-1.57-4.63-.16-.4-.53-.65-.95-.65h-5.1c-.42 0-.8.26-.94.66L9.6 7.6c-.02.06-.82 2.37-1.4 5.4H4v7h16v-7h-4.2c.49-1.34 1.25-3.08 1.67-4.14.03.04.05.08.09.12l.14.15c.61.64 1.48 1.02 2.38 1.02V7.78h-.08zM18 18H6v-3h12v3zm-3.04-5h-4.6l1.2-3.6h2.2l1.2 3.6z"/>
            <rect x="2" y="16" width="3" height="4" rx="1" fill="#f1c40f"/>
        </svg>`;

        const tools = [
            { id: 'road_major', icon: '<div class="icon-road"></div>', label: 'Build Road' },
            { id: 'park', icon: '🌳', label: 'Build Park' },
            { id: 'school', icon: '🏫', label: 'Build School' },
            { id: 'delete', icon: bulldozerSVG, label: 'Bulldoze', className: 'btn-delete' }
        ];

        const toolbar = document.getElementById('toolbar');
        toolbar.innerHTML = '';

        tools.forEach(tool => {
            const btn = document.createElement('button');
            btn.className = 'tool-btn';
            if (tool.className) btn.classList.add(tool.className);
            if (tool.id === this.activeTool) btn.classList.add('active');

            btn.innerHTML = tool.icon;
            btn.title = tool.label;

            btn.onclick = () => {
                this.activeTool = tool.id;
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
            toolbar.appendChild(btn);
        });
    }

    log(msg) {
        // Remote logger
        const formData = new FormData();
        formData.append('msg', msg);
        fetch('log.php', { method: 'POST', body: formData }).catch(() => { });
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
        let debugSource = "None";

        // 1. Try standard Raycast (objects)
        const target = this.sceneManager.raycast(event.clientX, event.clientY);

        if (target) {
            gridPos = this.worldToGrid(target.x, target.z);
            debugSource = "Raycast";
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
                debugSource = "Plane";
            }
        }

        // 3. Fallback: Sticky Edge (Last known valid)
        if (!gridPos && this.isMouseDown && this.lastValidGrid) {
            gridPos = { ...this.lastValidGrid };
            debugSource = "Sticky";
        }

        if (this.isMouseDown) {
            // Low-frequency log to capture dragging state
            //  this.log(`Source: ${debugSource} | Grid: ${gridPos ? gridPos.x + ',' + gridPos.z : 'NULL'}`);
        }

        if (!gridPos) return;

        // Clamp to Grid Size
        gridPos.x = Math.max(0, Math.min(CONFIG.GRID_SIZE - 1, gridPos.x));
        gridPos.z = Math.max(0, Math.min(CONFIG.GRID_SIZE - 1, gridPos.z));

        // Store as last valid (after clamping is safer)
        if (this.isMouseDown) {
            this.lastValidGrid = { ...gridPos };
        }

        // Final Bounds check
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
                this.log(`COMMIT Road: Start(${start.x},${start.z}) End(${end.x},${end.z}) Source:${debugSource}`);
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
