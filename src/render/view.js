import * as THREE from 'three';

export class CameraController {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;

        this.isDragging = false;
        this.lastMouse = new THREE.Vector2();

        this.setupEvents();
    }

    setupEvents() {
        this.domElement.addEventListener('mousedown', (e) => {
            if (e.button === 1) { // Middle click to pan
                this.isDragging = true;
                this.lastMouse.set(e.clientX, e.clientY);
                e.preventDefault(); // Prevent scroll icon usually
            }
        });

        this.domElement.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const deltaX = e.clientX - this.lastMouse.x;
                const deltaY = e.clientY - this.lastMouse.y;

                this.lastMouse.set(e.clientX, e.clientY);

                // Adjust zoom factor
                const zoom = this.camera.zoom;
                const panSpeed = 2 / zoom;

                // Orthographic camera movement
                // We want to move along the ground plane.
                // Camera looks at 0,0,0 from iso angle.

                // Simple screen space pan:
                this.camera.translateX(-deltaX * panSpeed);
                this.camera.translateY(deltaY * panSpeed);
            }
        });

        this.domElement.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        this.domElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.001;
            const minZoom = 0.1;
            const maxZoom = 5;

            this.camera.zoom -= e.deltaY * zoomSpeed * this.camera.zoom;
            this.camera.zoom = Math.max(minZoom, Math.min(maxZoom, this.camera.zoom));
            this.camera.updateProjectionMatrix();
        }, { passive: false });

        // Prevent context menu
        this.domElement.addEventListener('contextmenu', e => e.preventDefault());
    }
}
