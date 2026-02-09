/**
 * Utility function to recursively dispose of Three.js objects
 * and their associated geometries and materials.
 */
export function disposeObject(obj) {
    if (!obj) return;

    obj.traverse(node => {
        if (node.geometry) {
            node.geometry.dispose();
        }

        if (node.material) {
            if (Array.isArray(node.material)) {
                node.material.forEach(mat => disposeMaterial(mat));
            } else {
                disposeMaterial(node.material);
            }
        }
    });

    // Explicitly dispose properties of the object itself if they weren't covered by traverse
    // (though traverse should have hit them, sometimes groups/meshes have quirks)
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(mat => disposeMaterial(mat));
        else disposeMaterial(obj.material);
    }

    // Special check for textures stored in userData (from ModelFactory)
    if (obj.userData && obj.userData.texture) {
        obj.userData.texture.dispose();
    }
}

function disposeMaterial(mat) {
    mat.dispose();

    // Dispose of textures in maps
    for (const key in mat) {
        if (mat[key] && mat[key].isTexture) {
            mat[key].dispose();
        }
    }
}
