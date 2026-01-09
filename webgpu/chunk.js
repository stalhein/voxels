import { mat4, vec3 } from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";

const faces = new Int8Array([
    // Left
    0, 0, 0, 0,
    0, 1, 1, 0,
    0, 1, 0, 0,

    0, 0, 0, 0,
    0, 0, 1, 0,
    0, 1, 1, 0,

    // Right
    1, 0, 0, 1,
    1, 1, 0, 1,
    1, 1, 1, 1,

    1, 0, 0, 1,
    1, 1, 1, 1,
    1, 0, 1, 1,

    // Bottom
    0, 0, 0, 2,
    1, 0, 0, 2,
    1, 0, 1, 2,

    0, 0, 0, 2,
    1, 0, 1, 2,
    0, 0, 1, 2,

    // Top
    0, 1, 0, 3,
    1, 1, 1, 3,
    1, 1, 0, 3,

    0, 1, 0, 3,
    0, 1, 1, 3,
    1, 1, 1, 3,

    // Back
    0, 0, 0, 4,
    1, 1, 0, 4,
    1, 0, 0, 4,

    0, 0, 0, 4,
    0, 1, 0, 4,
    1, 1, 0, 4,

    // Front
    0, 0, 1, 5,
    1, 0, 1, 5,
    1, 1, 1, 5,

    0, 0, 1, 5,
    1, 1, 1, 5,
    0, 1, 1, 5
]);

const CHUNK_SIZE = 16;
const CHUNK_VOLUME = CHUNK_SIZE ** 3;

const VERTS_PER_FACE = 6;
const FACES_PER_BLOCK = 6;
const VERTS_PER_BLOCK = VERTS_PER_FACE * FACES_PER_BLOCK;
const STRIDE = 4;

export class Chunk {
    constructor(device) {
        this.device = device;

        this.blocks = new Uint8Array(CHUNK_VOLUME);
        this.blocks.fill(0);

        for (let z = 0; z < CHUNK_SIZE; ++z) {
            for (let y = 0; y < CHUNK_SIZE; ++y) {
                for (let x = 0; x < CHUNK_SIZE; ++x) {
                    if (x + z > y)  this.blocks[this.idx(x, y, z)] = 1;
                }
            }
        }


        const maxVerts = CHUNK_VOLUME * VERTS_PER_BLOCK;
        const vertexData = new ArrayBuffer(maxVerts * STRIDE * 4);

        
        this.vertexFloats = new Float32Array(vertexData);
        this.vertexInts = new Int32Array(vertexData);

        let v = 0;

        for (let z = 0; z < CHUNK_SIZE; ++z) {
            for (let y = 0; y < CHUNK_SIZE; ++y) {
                for (let x = 0; x < CHUNK_SIZE; ++x) {
                    if (this.getBlock(x, y, z) === 0) continue;

                    if (this.isAir(x-1, y, z))  v = this.addFace(v, x, y, z, 0);
                    if (this.isAir(x+1, y, z))  v = this.addFace(v, x, y, z, 1);
                    if (this.isAir(x, y-1, z))  v = this.addFace(v, x, y, z, 2);
                    if (this.isAir(x, y+1, z))  v = this.addFace(v, x, y, z, 3);
                    if (this.isAir(x, y, z-1))  v = this.addFace(v, x, y, z, 4);
                    if (this.isAir(x, y, z+1))  v = this.addFace(v, x, y, z, 5);
                }
            }
        }

        this.vertexCount = v;

        console.log(this.vertexCount);
        
        this.vertexBuffer = device.createBuffer({
            size: v * STRIDE * 4,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });

        device.queue.writeBuffer(this.vertexBuffer, 0, vertexData, 0, v * STRIDE*4);
    }

    addFace(v, x, y, z, normalIndex) {
        let base = normalIndex * VERTS_PER_FACE * STRIDE;
        for (let i = 0; i < VERTS_PER_FACE; ++i) {
            let src = base + i * STRIDE;
            let dst = v * STRIDE;

            this.vertexFloats[dst + 0] = faces[src + 0] + x;
            this.vertexFloats[dst + 1] = faces[src + 1] + y;
            this.vertexFloats[dst + 2] = faces[src + 2] + z;
            this.vertexInts[dst + 3] = faces[src + 3];

            v++;
        }
        return v;
    }

    idx(x, y, z) {
        return z * CHUNK_SIZE * CHUNK_SIZE + y * CHUNK_SIZE + x;
    }

    setBlock(x, y, z, block) {
        if (x < 0 || y < 0 || z < 0 || x >= CHUNK_SIZE || y >= CHUNK_SIZE || z >= CHUNK_SIZE)   return;
        this.blocks[this.idx(x, y, z)] = block;
    }

    getBlock(x, y, z) {
        if (x < 0 || y < 0 || z < 0 || x >= CHUNK_SIZE || y >= CHUNK_SIZE || z >= CHUNK_SIZE)   return 0;
        return this.blocks[this.idx(x, y, z)];
    }

    isAir(x, y, z) {
        if (x < 0 || y < 0 || z < 0 || x >= CHUNK_SIZE || y >= CHUNK_SIZE || z >= CHUNK_SIZE)   return true;
        return this.blocks[this.idx(x, y, z)] === 0;
    }

    draw(pass) {
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.draw(this.vertexCount);
    }
}