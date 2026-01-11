import {BlockType} from "./chunk.js";

const CHUNK_SIZE = 16;

self.onmessage = (e) => {
    const {key, blocks, neighbors} = e.data;

    const vertices = generateMesh(blocks, neighbors);

    self.postMessage(
        {key, vertices},
        [vertices.buffer]
    );
}


function generateMesh(blocks, neighbors) {
    const vertices = []

    const AXIS = [
        {axis: 0, direction: -1, normal: 0},
        {axis: 0, direction:  1, normal: 1},
        {axis: 1, direction: -1, normal: 2},
        {axis: 1, direction:  1, normal: 3},
        {axis: 2, direction: -1, normal: 4},
        {axis: 2, direction:  1, normal: 5},
    ];

    function getCoordOrder(axis, u, v, d) {
        if (axis == 0)  return [d, u, v];
        if (axis == 1)  return [u, d, v];
        return [u, v, d];
    }

    const mask = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    for (const {axis, direction, normal} of AXIS) {
        for (let d = 0; d < CHUNK_SIZE; ++d) {
            // Fill mask
            mask.fill(0);

            for (let u = 0; u < CHUNK_SIZE; ++u) {
                for (let v = 0; v < CHUNK_SIZE; ++v) {
                    const [x, y, z] = getCoordOrder(axis, u, v, d);
                    const [nx, ny, nz] = getCoordOrder(axis, u, v, d + direction);

                    const a = getLocalBlock(blocks, x, y, z);
                    const b = getBlock(blocks, nx, ny, nz, neighbors);

                    if (a !== BlockType.AIR && b === BlockType.AIR) mask[u * CHUNK_SIZE + v] = a;
                }
            }

            // Create mesh
            for (let u = 0; u < CHUNK_SIZE; ++u) {
                for (let v = 0; v < CHUNK_SIZE;) {
                    const blockType = mask[u * CHUNK_SIZE + v];
                    if (blockType == BlockType.AIR) {
                        v++;
                        continue;
                    }

                    // Expand width
                    let w = 1;
                    while (v + w < CHUNK_SIZE && mask[u * CHUNK_SIZE + v + w] == blockType) w++;

                    // Expand height
                    let h = 1;
                    outer:
                    while (u + h < CHUNK_SIZE) {
                        for (let k = 0; k < w; ++k) {
                            if (mask[(u+h) * CHUNK_SIZE + v + k] != blockType)  break outer;
                        }
                        h++;
                    }
                    console.log("hello");
                    addQuad(vertices, axis, direction, normal, d, u, v, w, h, blockType);

                    for (let du = 0; du < h; ++du) {
                        for (let dv = 0; dv < w; ++dv) {
                            mask[(u+du) * CHUNK_SIZE + v + dv] = 0;
                        }
                    }

                    v += w;
                }
            }
        }
    }

    return new Uint32Array(vertices);
}

function packVertex(x, y, z, normalIndex, blockType) {
    return (
        (x & 31) |
        ((y & 31) << 5) |
        ((z & 31) << 10) |
        ((normalIndex & 7) << 15) |
        ((blockType & 15) << 18)
    ) >>> 0;
}

function addQuad(vertices, axis, direction, normal, d, u, v, w, h, blockType) {
    let x = 0, y = 0, z = 0;
    let ux = 0, uy = 0, uz = 0;
    let vx = 0, vy = 0, vz = 0;

    if (axis == 0) {
        x = d + (direction == 1);
        y = u;
        z = v;
        uy = h;
        vz = w;
    } else if (axis == 1) {
        x = u;
        y = d + (direction == 1);
        z = v;
        ux = h;
        vz = w;
    } else {
        x = u;
        y = v;
        z = d + (direction == 1);
        ux = h;
        vy = w;
    }

    const v0 = packVertex(x, y, z, normal, blockType);
    const v1 = packVertex(x + ux, y + uy, z + uz, normal, blockType);
    const v2 = packVertex(x + ux + vx, y + uy + vy, z + uz + vz, normal, blockType);
    const v3 = packVertex(x + vx, y + vy, z + vz, normal, blockType);

    if (direction == 1)    vertices.push(v0, v1, v2, v0, v2, v3);
    else    vertices.push(v0, v2, v1, v0, v3, v2);
}

function idx(x, y, z) {
    return x * CHUNK_SIZE * CHUNK_SIZE + y * CHUNK_SIZE + z;
}

function inBounds(x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < CHUNK_SIZE && y < CHUNK_SIZE && z < CHUNK_SIZE;
}

function getLocalBlock(blocks, x, y, z) {
    if (!inBounds(x, y, z)) { return BlockType.AIR; }
    
    return blocks[idx(x, y, z)];
}

function getBlock(blocks, x, y, z, neighbors) {
    if (inBounds(x, y, z)) return getLocalBlock(blocks, x, y, z);
    
    if (x < 0) {
        const c = neighbors.nx;
        return c ? c[idx(x+CHUNK_SIZE, y, z)] : BlockType.STONE;
    }
    if (y < 0) {
        const c = neighbors.ny;
        return c ? c[idx(x, y+CHUNK_SIZE, z)] : BlockType.STONE;
    }
    if (z < 0) {
        const c = neighbors.nz;
        return c ? c[idx(x, y, z+CHUNK_SIZE)] : BlockType.STONE;
    }

    if (x >= CHUNK_SIZE) {
        const c = neighbors.px;
        return c ? c[idx(x-CHUNK_SIZE, y, z)] : BlockType.STONE;
    }
    if (y >= CHUNK_SIZE) {
        const c = neighbors.py;
        return c ? c[idx(x, y-CHUNK_SIZE, z)] : BlockType.STONE;
    }
    if (z >= CHUNK_SIZE) {
        const c = neighbors.pz;
        return c ? c[idx(x, y, z-CHUNK_SIZE)] : BlockType.STONE;
    }
}