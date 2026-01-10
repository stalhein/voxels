import {mat4, vec3} from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";
import FastNoiseLite from "./FastNoiseLite.js";

const CHUNK_SIZE = 16;
const CHUNK_VOLUME = CHUNK_SIZE ** 3;

const BlockType = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3
};

const faces = [
    // Left face
    0, 0, 0, 0,
    0, 1, 1, 2,
    0, 1, 0, 3,

    0, 0, 0, 0,
    0, 0, 1, 3,
    0, 1, 1, 1,

    // Right face
    1, 0, 0, 0,
    1, 1, 1, 1,
    1, 0, 1, 3,

    1, 0, 0, 0,
    1, 1, 0, 3,
    1, 1, 1, 2,

    // Bottom face
    0, 0, 0, 0,
    1, 0, 1, 2,
    0, 0, 1, 3,

    0, 0, 0, 0,
    1, 0, 0, 3,
    1, 0, 1, 1,

    // Top face
    0, 1, 0, 0,
    1, 1, 1, 1,
    1, 1, 0, 3,

    0, 1, 0, 0,
    0, 1, 1, 3,
    1, 1, 1, 2,

    // Back face
    0, 0, 0, 0,
    1, 1, 0, 1,
    1, 0, 0, 3,

    0, 0, 0, 0,
    0, 1, 0, 3,
    1, 1, 0, 2,

    // Front face
    0, 0, 1, 0,
    1, 1, 1, 2,
    0, 1, 1, 3,

    0, 0, 1, 0,
    1, 0, 1, 3,
    1, 1, 1, 1
];

export class Chunk {
    constructor(gl, world, x, y, z) {
        this.gl = gl;

        this.chunkX = x;
        this.chunkY = y;
        this.chunkZ = z;

        this.model = mat4.create();

        this.dirty = false;
        this.needsUploading = false;

        this.world = world;

        this.blocks = new Int8Array(CHUNK_VOLUME);

        this.vbo = null;
        this.vao = null;

        this.vertices = [];
    }

    async init() {
        mat4.translate(this.model, this.model, vec3.fromValues(this.chunkX*CHUNK_SIZE, this.chunkY*CHUNK_SIZE, this.chunkZ*CHUNK_SIZE));

        this.generateTerrain();
    }

    generateTerrain() {
        const noise = new FastNoiseLite();
        noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
        noise.SetFrequency(0.0067);
        noise.SetFractalType(FastNoiseLite.FractalType.FBm);
        noise.SetFractalOctaves(6);

        this.blocks.fill(BlockType.AIR);
        for (let x = 0; x < CHUNK_SIZE; ++x) {
            for (let z = 0; z < CHUNK_SIZE; ++z) {
                /*const noiseValue = noise.GetNoise(this.chunkX*CHUNK_SIZE + x,this.chunkZ * CHUNK_SIZE + z);
                const height = (noiseValue+1)/2 * CHUNK_SIZE*1;
                let localHeight = height - this.chunkY*CHUNK_SIZE;
                if (localHeight >= CHUNK_SIZE)  localHeight = CHUNK_SIZE;
                if (localHeight < 0)    localHeight = BlockType.AIR;

                for (let y = 0; y < localHeight; ++y) {
                    const realY = y + this.chunkY * CHUNK_SIZE;
                    if (realY >= height - 1)   this.blocks[this.idx(x, y, z)] = BlockType.GRASS;
                    else if (realY >= height - 2)   this.blocks[this.idx(x, y, z)] = BlockType.DIRT;
                    else    this.blocks[this.idx(x, y, z)] = BlockType.STONE;
                }*/
                for (let y = 0; y < x+z; ++y) {
                    this.blocks[this.idx(x, y, z)] = BlockType.GRASS;
                }
            }
        }

        this.dirty = true;
    }

    generateMesh() {
        

        for (let x = 0; x < CHUNK_SIZE; ++x) {
            // Fill mask
            const mask = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
            mask.fill(0);

            for (let y = 0; y < CHUNK_SIZE; ++y) {
                for (let z = 0; z < CHUNK_SIZE; ++z) {
                    const a = this.getBlock(x, y, z);
                    const b = this.getBlock(x-1, y, z);

                    if (a !== BlockType.AIR && b === BlockType.AIR) mask[y * CHUNK_SIZE + z] = a;
                }
            }

            // Create mesh
            for (let y = 0; y < CHUNK_SIZE; ++y) {
                for (let z = 0; z < CHUNK_SIZE;) {
                    const blockType = mask[y * CHUNK_SIZE + z];
                    if (blockType == BlockType.AIR) {
                        z++;
                        continue;
                    }

                    // Expand width
                    let w = 1;
                    while (z + w < CHUNK_SIZE && mask[y * CHUNK_SIZE + z + w] == blockType) w++;

                    // Expand height
                    let h = 1;
                    outer:
                    while (y + h < CHUNK_SIZE) {
                        for (let k = 0; k < w; ++k) {
                            if (mask[(y+h) * CHUNK_SIZE + z + k] != blockType)  break outer;
                        }
                        h++;
                    }

                    this.addQuadX(x, y, z, w, h, 0, blockType);

                    for (let dy = 0; dy < h; ++dy) {
                        for (let dz = 0; dz < w; ++dz) {
                            mask[(y+dy) * CHUNK_SIZE + z + dz] = 0;
                        }
                    }

                    z += w;
                }
            }
        }

        this.dirty = false;
        this.needsUploading = true;
    }

    uploadMesh() {
        const gl = this.gl;

        this.vao = gl.createVertexArray();
        this.vbo = gl.createBuffer();

        gl.bindVertexArray(this.vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Uint32Array(this.vertices),
            gl.STATIC_DRAW
        );

        gl.enableVertexAttribArray(0);
        gl.vertexAttribIPointer(
            0,
            1,
            gl.UNSIGNED_INT,
            4,
            0
        );

        gl.bindVertexArray(null);

        this.needsUploading = false;
    }

    render() {
        const gl = this.gl;
        gl.bindVertexArray(this.vao);
        //gl.drawArrays(gl.LINES, 0, 810);
        gl.drawArrays(gl.TRIANGLES, 0, this.vertices.length);
    }

    idx(x, y, z) {
        return x * CHUNK_SIZE * CHUNK_SIZE + y * CHUNK_SIZE + z;
    }

    inBounds(x, y, z) {
        return x >= 0 && y >= 0 && z >= 0 && x < CHUNK_SIZE && y < CHUNK_SIZE && z < CHUNK_SIZE;
    }

    solidBlock(x, y, z) {
        return this.getBlock(x, y, z) != BlockType.AIR;
    }

    packVertex(x, y, z, normalIndex, blockType) {
        return (
            (x & 31) |
            ((y & 31) << 5) |
            ((z & 31) << 10) |
            ((normalIndex & 7) << 15) |
            ((blockType & 15) << 18)
        ) >>> 0;
    }

    addFace(x, y, z, normalIndex, blockType) {
        const base = normalIndex * 24;
        for (let i = 0; i < 6; ++i) {
            const lx = faces[base+i*4+0] + x;
            const ly = faces[base+i*4+1] + y;
            const lz = faces[base+i*4+2] + z;
            this.vertices.push(this.packVertex(lx, ly, lz, normalIndex, blockType));
        }
    }

    addQuadX(x, y, z, w, h, normalIndex, blockType) {
        const v0 = this.packVertex(x, y, z, normalIndex, blockType);
        const v1 = this.packVertex(x, y+h, z, normalIndex, blockType);
        const v2 = this.packVertex(x, y+h, z+w, normalIndex, blockType);
        const v3 = this.packVertex(x, y, z+w, normalIndex, blockType);

        this.vertices.push(v0, v1, v2);
        this.vertices.push(v0, v2, v3);
    }

    getLocalBlock(x, y, z) {
        if (!this.inBounds(x, y, z)) { return BlockType.AIR; }
        
        return this.blocks[this.idx(x, y, z)];
    }

    getBlock(x, y, z) {
        return this.world.getBlockAtWorld(this.chunkX * CHUNK_SIZE + x, this.chunkY * CHUNK_SIZE + y, this.chunkZ * CHUNK_SIZE + z);
    }
}