import {mat4, vec3} from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";
import FastNoiseLite from "./FastNoiseLite.js";
import {World} from "./world.js";

const CHUNK_SIZE = 16;
const CHUNK_VOLUME = CHUNK_SIZE ** 3;

const faces = [
    // Left face
    0, 0, 0, 0,
    0, 1, 0, 2,
    0, 1, 1, 3,

    0, 0, 0, 0,
    0, 1, 1, 3,
    0, 0, 1, 1,

    // Right face
    1, 0, 0, 0,
    1, 0, 1, 1,
    1, 1, 1, 3,

    1, 0, 0, 0,
    1, 1, 1, 3,
    1, 1, 0, 2,

    // Bottom face
    0, 0, 0, 0,
    0, 0, 1, 2,
    1, 0, 1, 3,

    0, 0, 0, 0,
    1, 0, 1, 3,
    1, 0, 0, 1,

    // Top face
    0, 1, 0, 0,
    1, 1, 0, 1,
    1, 1, 1, 3,

    0, 1, 0, 0,
    1, 1, 1, 3,
    0, 1, 1, 2,

    // Back face
    0, 0, 0, 0,
    1, 0, 0, 1,
    1, 1, 0, 3,

    0, 0, 0, 0,
    1, 1, 0, 3,
    0, 1, 0, 2,

    // Front face
    0, 0, 1, 0,
    0, 1, 1, 2,
    1, 1, 1, 3,

    0, 0, 1, 0,
    1, 1, 1, 3,
    1, 0, 1, 1
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

        this.blocks.fill(0);
        for (let x = 0; x < CHUNK_SIZE; ++x) {
            for (let z = 0; z < CHUNK_SIZE; ++z) {
                const noiseValue = noise.GetNoise(this.chunkX*CHUNK_SIZE + x,this.chunkZ * CHUNK_SIZE + z);
                const height = (noiseValue+1)/2 * CHUNK_SIZE*4;
                let localHeight = height - this.chunkY*CHUNK_SIZE;
                if (localHeight >= CHUNK_SIZE)  localHeight = CHUNK_SIZE;
                if (localHeight < 0)    localHeight = 0;

                for (let y = 0; y < localHeight; ++y) {
                    this.blocks[this.idx(x, y, z)] = 1;
                }
            }
        }

        this.dirty = true;
    }

    generateMesh() {
        for (let x = 0; x < CHUNK_SIZE; ++x) {
            for (let y = 0; y < CHUNK_SIZE; ++y) {
                for (let z = 0; z < CHUNK_SIZE; ++z) {
                    if (this.blocks[this.idx(x, y, z)] == 0)    continue;
                    
                    if (!this.solidBlock(x-1, y, z))   this.addFace(x, y, z, 0);
                    if (!this.solidBlock(x+1, y, z))   this.addFace(x, y, z, 1);
                    if (!this.solidBlock(x, y-1, z))   this.addFace(x, y, z, 2);
                    if (!this.solidBlock(x, y+1, z))   this.addFace(x, y, z, 3);
                    if (!this.solidBlock(x, y, z-1))   this.addFace(x, y, z, 4);
                    if (!this.solidBlock(x, y, z+1))   this.addFace(x, y, z, 5);
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
        gl.drawArrays(gl.TRIANGLES, 0, this.vertices.length);
    }

    idx(x, y, z) {
        return x * CHUNK_SIZE * CHUNK_SIZE + y * CHUNK_SIZE + z;
    }

    inBounds(x, y, z) {
        return x >= 0 && y >= 0 && z >= 0 && x < CHUNK_SIZE && y < CHUNK_SIZE && z < CHUNK_SIZE;
    }

    solidBlock(x, y, z) {
        return this.getBlock(x, y, z) != 0;
    }

    packVertex(x, y, z, normalIndex) {
        return (
            (x & 31) |
            ((y & 31) << 5) |
            ((z & 31) << 10) |
            ((normalIndex & 7) << 15)
        ) >>> 0;
    }

    addFace(x, y, z, normalIndex) {
        const base = normalIndex * 24;
        for (let i = 0; i < 6; ++i) {
            const lx = faces[base+i*4+0] + x;
            const ly = faces[base+i*4+1] + y;
            const lz = faces[base+i*4+2] + z;
            this.vertices.push(this.packVertex(lx, ly, lz, normalIndex));
        }
    }

    getLocalBlock(x, y, z) {
        if (!this.inBounds(x, y, z)) { return 0; }
        
        return this.blocks[this.idx(x, y, z)];
    }

    getBlock(x, y, z) {
        return this.world.getBlockAtWorld(this.chunkX * CHUNK_SIZE + x, this.chunkY * CHUNK_SIZE + y, this.chunkZ * CHUNK_SIZE + z);
    }
}