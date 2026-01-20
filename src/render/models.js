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

    createHospitalMesh: () => {
        const group = new THREE.Group();
        const cellSize = CONFIG.CELL_SIZE;

        // Base/Lower Wing
        const baseGeo = new THREE.BoxGeometry(cellSize * 0.9, 3.6, cellSize * 0.6);
        const baseMat = new THREE.MeshLambertMaterial({ color: 0xffffff }); // Hospital white
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 1.8;
        group.add(base);

        // Main Tower
        const towerGeo = new THREE.BoxGeometry(cellSize * 0.4, 9, cellSize * 0.4);
        const tower = new THREE.Mesh(towerGeo, baseMat);
        tower.position.set(-cellSize * 0.2, 4.5, 0);
        group.add(tower);

        // Helipad
        const heliGeo = new THREE.CylinderGeometry(cellSize * 0.2, cellSize * 0.2, 0.3, 12);
        const heliMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const helipad = new THREE.Mesh(heliGeo, heliMat);
        helipad.position.set(cellSize * 0.2, 3.75, 0);
        group.add(helipad);

        // Red Cross on Tower
        const crossHGeo = new THREE.BoxGeometry(cellSize * 0.15, cellSize * 0.15, 0.05);
        const crossVGeo = new THREE.BoxGeometry(cellSize * 0.05, cellSize * 0.45, 0.05);
        const crossMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

        const cH = new THREE.Mesh(crossHGeo, crossMat);
        const cV = new THREE.Mesh(crossVGeo, crossMat);
        cH.position.set(-cellSize * 0.2, 7.5, cellSize * 0.2 + 0.01);
        cV.position.set(-cellSize * 0.2, 7.5, cellSize * 0.2 + 0.01);
        group.add(cH, cV);

        return group;
    },

    createFireStationMesh: () => {
        const group = new THREE.Group();
        const cellSize = CONFIG.CELL_SIZE;

        // Main Garage Body
        const mainGeo = new THREE.BoxGeometry(cellSize * 0.9, 5.4, cellSize * 0.7);
        const mainMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.FIRE_STATION });
        const body = new THREE.Mesh(mainGeo, mainMat);
        body.position.y = 2.7;
        group.add(body);

        // Hose Tower
        const towerGeo = new THREE.BoxGeometry(cellSize * 0.25, 10.5, cellSize * 0.25);
        const tower = new THREE.Mesh(towerGeo, mainMat);
        tower.position.set(cellSize * 0.3, 5.25, cellSize * 0.2);
        group.add(tower);

        // Garage Doors (3 bays)
        const doorGeo = new THREE.BoxGeometry(cellSize * 0.2, 3.6, 0.1);
        const doorMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        for (let i = -1; i <= 1; i++) {
            const door = new THREE.Mesh(doorGeo, doorMat);
            door.position.set(i * cellSize * 0.25, 1.8, cellSize * 0.35 + 0.01);
            group.add(door);
        }

        return group;
    },

    createSchoolMesh: () => {
        const group = new THREE.Group();
        const cellSize = CONFIG.CELL_SIZE;

        // U-Shaped structure
        const wingMat = new THREE.MeshLambertMaterial({ color: 0xedc9af }); // Sand/Tan

        // Back wing
        const backGeo = new THREE.BoxGeometry(cellSize * 0.8, 3.6, cellSize * 0.2);
        const back = new THREE.Mesh(backGeo, wingMat);
        back.position.set(0, 1.8, -cellSize * 0.3);
        group.add(back);

        // Left wing
        const sideGeo = new THREE.BoxGeometry(cellSize * 0.2, 3.6, cellSize * 0.6);
        const left = new THREE.Mesh(sideGeo, wingMat);
        left.position.set(-cellSize * 0.3, 1.8, cellSize * 0.1);
        group.add(left);

        // Right wing
        const right = new THREE.Mesh(sideGeo, wingMat);
        right.position.set(cellSize * 0.3, 1.8, cellSize * 0.1);
        group.add(right);

        // Small Clock Tower centerpiece
        const towerGeo = new THREE.BoxGeometry(cellSize * 0.15, 6, cellSize * 0.15);
        const towerMat = new THREE.MeshLambertMaterial({ color: 0x8b4513 }); // Brown brick
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.set(0, 3, -cellSize * 0.3);
        group.add(tower);

        return group;
    },

    createParkMesh: (width = 1, depth = 1) => {
        const group = new THREE.Group();
        const cellSize = CONFIG.CELL_SIZE;

        // Base Grass Patch (Rectangular or Circular depending on size)
        const w = width * cellSize * 0.95;
        const d = depth * cellSize * 0.95;

        let base;
        if (width === 1 && depth === 1) {
            const gGeo = new THREE.CylinderGeometry(cellSize * 0.45, cellSize * 0.45, 0.4, 16);
            const gMat = new THREE.MeshLambertMaterial({ color: 0x2d4c1e });
            base = new THREE.Mesh(gGeo, gMat);
        } else {
            const gGeo = new THREE.BoxGeometry(w, 0.4, d);
            const gMat = new THREE.MeshLambertMaterial({ color: 0x2d4c1e });
            base = new THREE.Mesh(gGeo, gMat);
        }
        base.position.y = 0.2;
        group.add(base);

        // Pathway (Gravel strip)
        const isWide = width > depth;
        const pGeo = new THREE.BoxGeometry(
            isWide ? w : cellSize * 0.2,
            0.1,
            isWide ? cellSize * 0.2 : d
        );
        const pMat = new THREE.MeshLambertMaterial({ color: 0x777777 });
        const path = new THREE.Mesh(pGeo, pMat);
        path.position.y = 0.41;
        group.add(path);

        // Trees
        const area = width * depth;
        const treeCount = Math.floor(2 + area * 1.5);

        const treeCreator = (x, z, scale) => {
            const tree = new THREE.Group();
            const trunkGeo = new THREE.CylinderGeometry(cellSize * 0.05, cellSize * 0.05, 1.5 * 3 * scale, 6);
            const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = (1.5 * 3 * scale) / 2;
            tree.add(trunk);

            const leafGeo = new THREE.ConeGeometry(cellSize * 0.3, 2 * 3 * scale, 8);
            const leafMat = new THREE.MeshLambertMaterial({ color: 0x1e5927 });
            const leaves = new THREE.Mesh(leafGeo, leafMat);
            leaves.position.y = (1.5 * 3 * scale) + (2 * 3 * scale) / 2 - 0.5;
            tree.add(leaves);

            tree.position.set(x, 0.4, z);
            return tree;
        };

        for (let i = 0; i < treeCount; i++) {
            const tx = (Math.random() - 0.5) * w * 0.8;
            const tz = (Math.random() - 0.5) * d * 0.8;
            if (isWide && Math.abs(tz) < cellSize * 0.15) continue;
            if (!isWide && Math.abs(tx) < cellSize * 0.15) continue;
            group.add(treeCreator(tx, tz, 0.6 + Math.random() * 0.5));
        }

        // Benches
        const benchCount = Math.floor(area);
        for (let i = 0; i < benchCount; i++) {
            const benchGroup = new THREE.Group();
            const woodMat = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
            const seatGeo = new THREE.BoxGeometry(1.5, 0.2, 0.6);
            const seat = new THREE.Mesh(seatGeo, woodMat);
            seat.position.y = 0.5;
            benchGroup.add(seat);

            const legGeo = new THREE.BoxGeometry(0.1, 0.5, 0.1);
            const leg1 = new THREE.Mesh(legGeo, woodMat);
            leg1.position.set(-0.6, 0.25, 0.2);
            benchGroup.add(leg1);
            const leg2 = leg1.clone();
            leg2.position.set(0.6, 0.25, 0.2);
            benchGroup.add(leg2);

            const side = Math.random() > 0.5 ? 1 : -1;
            const bx = isWide ? (Math.random() - 0.5) * w * 0.7 : (w / 2 - 1) * side;
            const bz = isWide ? (d / 2 - 1) * side : (Math.random() - 0.5) * d * 0.7;

            benchGroup.position.set(bx, 0.4, bz);
            benchGroup.rotation.y = Math.random() * Math.PI * 2;
            group.add(benchGroup);
        }

        if (width > 1 || depth > 1) {
            group.translateX((width - 1) * cellSize / 2);
            group.translateZ((depth - 1) * cellSize / 2);
        }

        return group;
    },

    createRoadMesh: (type) => {
        // ... handled in main currently, but could move here
    }
};
