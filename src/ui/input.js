import { CONFIG } from '../config.js';
import * as THREE from 'three';

export class InputManager {
    constructor(sceneManager, grid, onAction, onPreview) {
        this.sceneManager = sceneManager;
        this.grid = grid;
        this.onAction = onAction;
        this.onPreview = onPreview;
        this.activeTool = 'road_major';
        this.isRotated = false;

        this.isMouseDown = false;
        this.dragStartGrid = null;
        this.lastValidGrid = null;

        this.setupEventListeners();
        this.setupToolbar();
        this.setupKeyboardListeners();
    }

    setupKeyboardListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'r') {
                this.isRotated = !this.isRotated;
                // Force cursor update
                if (this.lastMouseEvent) this.updateCursor(this.lastMouseEvent);
            }
        });
    }

    getToolDimensions() {
        if (this.activeTool.startsWith('park:')) {
            const parts = this.activeTool.split(':');
            let w = parseInt(parts[1]);
            let d = parseInt(parts[2]);
            if (this.isRotated) return { w: d, d: w };
            return { w, d };
        }
        return { w: 1, d: 1 };
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
            this.lastMouseEvent = e;
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
        const tools = [
            { id: 'road_major', icon: '<div class="icon-road"></div>', label: 'Build Road' },
            {
                id: 'park',
                icon: '🌳',
                label: 'Build Park',
                subTools: [
                    { id: 'park:2:2', label: 'Large Park (2x2, AoE: 8tiles)', icon: '<img src="assets/park_2x2.png" style="width: 24px; height: 24px;">' },
                    { id: 'park:1:2', label: 'Medium Park (1x2, AoE: 5tiles)', icon: '<img src="assets/park_1x2.png" style="width: 24px; height: 24px;">' },
                    { id: 'park:1:1', label: 'Small Park (1x1, AoE: 4tiles)', icon: '<img src="assets/park_1x1.png" style="width: 24px; height: 24px;">' }
                ]
            },
            { id: 'school', icon: '🏫', label: 'Build School' },
            { id: 'hospital', icon: '🏥', label: 'Build Hospital' },
            { id: 'fire_station', icon: '🚒', label: 'Build Fire Station' },
            { id: 'delete', icon: `<img src="assets/bulldozer.png?v=${Date.now()}" style="width: 24px; height: 24px; object-fit: contain;">`, label: 'Bulldoze', className: 'btn-delete' }
        ];

        const toolbar = document.getElementById('toolbar');
        toolbar.innerHTML = '';

        tools.forEach(tool => {
            const btn = document.createElement('button');
            btn.className = 'tool-btn';
            if (tool.className) btn.classList.add(tool.className);

            // Set initial active state correctly for sub-tools
            const isActive = this.activeTool === tool.id || (this.activeTool.startsWith(tool.id + ':'));
            if (isActive) btn.classList.add('active');

            btn.innerHTML = tool.icon;
            btn.title = tool.label;

            // Handle Sub-tools
            if (tool.subTools) {
                const subMenu = document.createElement('div');
                subMenu.className = 'sub-tool-container';

                tool.subTools.forEach(sub => {
                    const subBtn = document.createElement('button');
                    subBtn.className = 'sub-tool-btn';
                    subBtn.innerText = sub.icon;
                    subBtn.title = sub.label;
                    if (this.activeTool === sub.id) subBtn.classList.add('active');

                    subBtn.onclick = (e) => {
                        e.stopPropagation();
                        this.activeTool = sub.id;
                        document.querySelectorAll('.tool-btn, .sub-tool-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        subBtn.classList.add('active');
                        // Update main icon to show selection?
                        // btn.innerHTML = tool.icon + `<span style="font-size: 10px; position: absolute; bottom: 2px; right: 2px;">${sub.icon}</span>`;
                        subMenu.classList.remove('active');
                    };
                    subMenu.appendChild(subBtn);
                });
                btn.appendChild(subMenu);

                btn.onmouseenter = () => subMenu.classList.add('active');
                btn.onmouseleave = () => subMenu.classList.remove('active');
            }

            btn.onclick = () => {
                if (tool.subTools) {
                    // If it has sub-tools, clicking main button just selects the tool (default sub-tool if none active)
                    if (!this.activeTool.startsWith(tool.id + ':')) {
                        this.activeTool = tool.subTools[0].id; // Default to first
                    }
                } else {
                    this.activeTool = tool.id;
                }

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
                let toolStr = this.activeTool;
                if (this.activeTool.startsWith('park:')) {
                    const dims = this.getToolDimensions();
                    toolStr = `park:${dims.w}:${dims.d}`;
                }
                this.onAction(toolStr, gridPos, gridPos);
            }
        }
    }

    updateCursor(event) {
        const target = this.sceneManager.raycast(event.clientX, event.clientY);
        const dims = this.getToolDimensions();

        if (!this.cursorMesh) {
            if (this.sceneManager.scene) {
                const geometry = new THREE.BoxGeometry(CONFIG.CELL_SIZE, 0.5, CONFIG.CELL_SIZE);
                const material = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.3, transparent: true });
                this.cursorMesh = new THREE.Mesh(geometry, material);
                this.sceneManager.scene.add(this.cursorMesh);
            }
        }

        // Scale cursor to match tool
        if (this.cursorMesh) {
            this.cursorMesh.scale.set(dims.w, 1, dims.d);
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

            // Adjust position for multi-tile preview so it aligns with pivot
            const offsetX = (dims.w - 1) * CONFIG.CELL_SIZE / 2;
            const offsetZ = (dims.d - 1) * CONFIG.CELL_SIZE / 2;

            this.cursorMesh.position.set(worldPos.x + offsetX, 0.5, worldPos.z + offsetZ);
        }
    }
}
