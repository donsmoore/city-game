import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class SceneManager {
    constructor() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);
        this.scene.fog = new THREE.Fog(0x111111, 400, 900); // Pushed back significantly

        // Camera
        const aspect = window.innerWidth / window.innerHeight;
        const d = 200;
        this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
        this.camera.position.set(200, 200, 200);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        // Lighting
        this.setupLights();

        // Grid Helper (visual reference)
        const gridSize = CONFIG.GRID_SIZE * CONFIG.CELL_SIZE;
        // Offset to match our logical grid (0,0 is corner vs center)
        // Three.js gridhelper centers at 0,0. Our grid logic starts at 0,0 index.
        // We'll map world 0,0 to grid index 0,0 for simplicity, or center it.
        // Let's Center the grid in world space.
        // Grid Index (0,0) -> World (-TotalSize/2, -TotalSize/2)

        const gridHelper = new THREE.GridHelper(gridSize, CONFIG.GRID_SIZE, 0x444444, 0x222222);
        this.scene.add(gridHelper);

        // Ground Plane with Noise Texture
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Fill base
        ctx.fillStyle = '#1a330a'; // Dark green base
        ctx.fillRect(0, 0, 512, 512);

        // Noise
        for (let i = 0; i < 5000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const w = Math.random() * 20 + 5;
            const h = Math.random() * 20 + 5;
            const c = Math.random();
            if (c > 0.6) ctx.fillStyle = 'rgba(100, 150, 80, 0.1)'; // Lighter green
            else if (c > 0.3) ctx.fillStyle = 'rgba(60, 40, 20, 0.1)'; // Brown dirt
            else ctx.fillStyle = 'rgba(30, 60, 30, 0.1)'; // Dark spot

            ctx.beginPath();
            ctx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);

        const geometry = new THREE.PlaneGeometry(gridSize, gridSize); // Exact grid bounds
        const material = new THREE.MeshLambertMaterial({ map: texture });
        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.translateY(-0.2); // Below everything
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Handle Resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x666666);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(100, 200, 100);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 500;

        const size = CONFIG.GRID_SIZE * CONFIG.CELL_SIZE / 2 * 1.5;
        dirLight.shadow.camera.left = -size;
        dirLight.shadow.camera.right = size;
        dirLight.shadow.camera.top = size;
        dirLight.shadow.camera.bottom = -size;

        this.scene.add(dirLight);
    }

    onWindowResize() {
        const aspect = window.innerWidth / window.innerHeight;
        const d = 200;
        this.camera.left = -d * aspect;
        this.camera.right = d * aspect;
        this.camera.top = d;
        this.camera.bottom = -d;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    // Convert screen coordinates to world coordinates on the ground plane
    raycast(x, y) {
        const mouse = new THREE.Vector2();
        mouse.x = (x / window.innerWidth) * 2 - 1;
        mouse.y = -(y / window.innerHeight) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const target = new THREE.Vector3();
        const intersection = raycaster.ray.intersectPlane(plane, target);

        return intersection ? target : null;
    }
}
