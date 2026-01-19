import * as THREE from 'three';
import { CONFIG } from '../config.js';

export const ModelFactory = {
    createBuildingMesh: (metadata, width, depth) => {
        const floorHeight = 1; // Visual height unit per floor? 
        // Note: metadata.height is in "game units"? 
        // Earlier: height 1 = 10 people. 
        // CONFIG.CELL_SIZE = 10.
        // Let's assume metadata.height corresponds to floors directly?
        // User asked: "Add glass windows... equivelents to 1 floor height".
        // Current sim adds 0.5 height steps.
        // Let's treat metadata.height as "Floor Count".

        const floors = Math.floor(metadata.height); // Integer floors
        const h = metadata.height * CONFIG.CELL_SIZE * 0.2; // Physical height (20% scaled)
        const w = width * CONFIG.CELL_SIZE * 0.8;
        const d = depth * CONFIG.CELL_SIZE * 0.8;

        const geometry = new THREE.BoxGeometry(w, h, d);

        // Shift geometry up so pivot is at bottom
        geometry.translate(0, h / 2, 0);

        // Create Materials with Textures
        // We need a unique texture based on color perhaps, or just standard window texture tinting?
        // Let's procedurally create a canvas texture for windows.

        if (!ModelFactory.windowTexture) {
            ModelFactory.windowTexture = ModelFactory.createWindowTexture();
        }

        // Clone material to allow different colors
        // Use an array of materials for Box (Right, Left, Top, Bottom, Front, Back)
        // 0:Right, 1:Left, 2:Top, 3:Bottom, 4:Front, 5:Back

        const sideMat = new THREE.MeshLambertMaterial({
            color: metadata.color,
            map: ModelFactory.windowTexture
        });

        const roofMat = new THREE.MeshLambertMaterial({ color: 0x333333 }); // Dark roof

        // We need to clone the texture to set repeat per mesh?
        // Or set UVs in geometry? 
        // Easiest is cloning texture or using separate materials if texture is shared but UVs differ.
        // But ThreeJS textures are shared? 
        // If we change .repeat on a texture, it changes for all using it.
        // So we must CLONE the texture for every building size variance? Expensive.
        // Better: Modify UV attributes of the geometry.

        // UV Logic:
        // Y axis: 0 to floors.
        // X/Z axis: 0 to width/depth ratios?

        // Let's modify UVs manually.
        const uvs = geometry.attributes.uv;
        // BoxGeometry UV layout is standard.
        // We know dimensions.

        // Iterate faces and scale UVs?
        // BoxGeometry: 6 groups of 4 vertices (2 triangles each fake).
        // Actually BoxGeometry is indexed.
        // Non-indexed is easier to process logic but standard Box is fine.

        // Simpler approach: Clone the texture. CanvasTexture is heavy? 
        // No, it's just a wrapper. The image source is same.
        // Actually, if we use the SAME image source, we can have multiple textures with different repeats.

        const texture = ModelFactory.windowTexture.clone();
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, metadata.height); // 1 repeat horizontally, N vertically (floors)

        // Correction: Vertical repeat is strictly floors. Horizontal repeat?
        // If building is wide, maybe more windows?
        // Let's scale horizontal repeat by width/depth.
        // But "width" passed in is 1 or 2 (in grid cells).
        texture.repeat.set(Math.max(1, width), metadata.height);
        texture.needsUpdate = true;

        const matWithTexture = new THREE.MeshLambertMaterial({
            color: metadata.color,
            map: texture
        });

        const materials = [
            matWithTexture, // Right
            matWithTexture, // Left
            roofMat,        // Top
            roofMat,        // Bottom
            matWithTexture, // Front
            matWithTexture  // Back
        ];

        const mesh = new THREE.Mesh(geometry, materials);

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Store texture to dispose later?
        mesh.userData.texture = texture;

        return mesh;
    },

    createWindowTexture: () => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Background (Wall)
        ctx.fillStyle = '#ffffff'; // White tint, color comes from material
        ctx.fillRect(0, 0, 64, 64);

        // Windows (Blueish/Dark) -> multiplied by material color will be dark
        // Let's make windows black/grey so they stand out against color.
        // Or using alpha? No, Lambert.
        // If material is Red, White wall = Red. Black window = Black.

        ctx.fillStyle = '#444444'; // Dark Grey Windows

        // Draw 2x2 windows pattern or strips
        // 1 floor = 1 repeat of this texture.
        // Let's draw a row of windows.

        const gap = 8;
        const winW = (64 - 3 * gap) / 2;
        const winH = 40; // Windows take up bulk of height

        // Row 1
        ctx.fillRect(gap, 12, winW, winH);
        ctx.fillRect(gap * 2 + winW, 12, winW, winH);

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    },

    createRoadMesh: (type) => {
        // ... handled in main currently, but could move here
    }
};
