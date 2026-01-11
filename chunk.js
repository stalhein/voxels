import {mat4, vec3} from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";

const CHUNK_SIZE = 16;
const CHUNK_VOLUME = CHUNK_SIZE ** 3;

export const BlockType = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3
};

export class Chunk {
    constructor(gl, world, x, y, z) {
        this.gl = gl;

        this.chunkX = x;
        this.chunkY = y;
        this.chunkZ = z;

        this.model = mat4.create();

        this.needsTerraining = false;
        this.dirty = false;
        this.needsUploading = false;
        this.meshing = false;

        this.world = world;

        this.blocks = new Int8Array(CHUNK_VOLUME);

        this.vbo = null;
        this.vao = null;

        this.vertices = [];

        this.heightMap = new Int8Array(CHUNK_SIZE * CHUNK_SIZE);
    }

    async init() {
        mat4.translate(this.model, this.model, vec3.fromValues(this.chunkX*CHUNK_SIZE, this.chunkY*CHUNK_SIZE, this.chunkZ*CHUNK_SIZE));

        this.generateTerrain();
    }

    generateHeights() {
        for (let x = 0; x < CHUNK_SIZE; ++x) {
            for (let z = 0; z < CHUNK_SIZE; ++z) {
                const height = this.getHeight(x, z);
                this.heightMap[x * CHUNK_SIZE + z] = height;
            }
        }
    }

    generateTerrain() {
        this.generateHeights();

        this.blocks.fill(BlockType.AIR);
        for (let x = 0; x < CHUNK_SIZE; ++x) {
            for (let z = 0; z < CHUNK_SIZE; ++z) {
                const height = this.heightMap[x * CHUNK_SIZE + z];
                
                let localHeight = height - this.chunkY*CHUNK_SIZE;
                if (localHeight >= CHUNK_SIZE)  localHeight = CHUNK_SIZE;
                if (localHeight < 0)    localHeight = BlockType.AIR;

                for (let y = 0; y < localHeight; ++y) {
                    const realY = y + this.chunkY * CHUNK_SIZE;

                    if (this.world.biomeNoise.GetNoise(x + this.chunkX * CHUNK_SIZE, z + this.chunkZ * CHUNK_SIZE) >= 0.3)  this.blocks[this.idx(x, y, z)] = BlockType.STONE;
                    else    this.blocks[this.idx(x, y, z)] = BlockType.GRASS;
                    /*if (realY >= height - 1)   this.blocks[this.idx(x, y, z)] = BlockType.GRASS;
                    else if (realY >= height - 2)   this.blocks[this.idx(x, y, z)] = BlockType.DIRT;
                    else    this.blocks[this.idx(x, y, z)] = BlockType.STONE;*/
                }
            }
        }

        this.needsTerraining = false;
        this.dirty = true;
    }

    getHeight(x, z) {
        const wx = x + this.chunkX * CHUNK_SIZE;
        const wz = z + this.chunkZ * CHUNK_SIZE;

        const selectorValue = (this.world.biomeNoise.GetNoise(wx, wz) + 1) * 0.5;

        const plainsHeight = this.getPlainsHeight(wx, wz);
        const mountainsHeight = this.getMountainsHeight(wx, wz);

        const smoothStep = selectorValue * selectorValue * (3 - 2 * selectorValue);

        return plainsHeight + (mountainsHeight - plainsHeight) * smoothStep;
    }

    getPlainsHeight(wx, wz) {
        const noiseValue = (this.world.terrainNoise.GetNoise(wx*0.5, wz*0.5) + 1) * 0.5;

        return 16 + noiseValue * 2;
    }

    getMountainsHeight(wx, wz) {
        let noiseValue = (this.world.terrainNoise.GetNoise(wx*1.01, wz*1.01) + 1) * 0.5;
        noiseValue = Math.pow(noiseValue, 1.3);

        return 16 + noiseValue * 96;
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

    getLocalBlock(x, y, z) {
        if (!this.inBounds(x, y, z)) { return BlockType.AIR; }
        
        return this.blocks[this.idx(x, y, z)];
    }

    getBlock(x, y, z, neighbors) {
        if (this.inBounds(x, y, z)) return this.getLocalBlock(x, y, z);
        
        if (x < 0) {
            const c = neighbors.nx;
            return c ? c.getLocalBlock(x+CHUNK_SIZE, y, z) : BlockType.STONE;
        }
        if (y < 0) {
            const c = neighbors.ny;
            return c ? c.getLocalBlock(x, y+CHUNK_SIZE, z) : BlockType.STONE;
        }
        if (z < 0) {
            const c = neighbors.nz;
            return c ? c.getLocalBlock(x, y, z+CHUNK_SIZE) : BlockType.STONE;
        }

        if (x >= CHUNK_SIZE) {
            const c = neighbors.px;
            return c ? c.getLocalBlock(x-CHUNK_SIZE, y, z) : BlockType.STONE;
        }
        if (y >= CHUNK_SIZE) {
            const c = neighbors.py;
            return c ? c.getLocalBlock(x, y-CHUNK_SIZE, z) : BlockType.STONE;
        }
        if (z >= CHUNK_SIZE) {
            const c = neighbors.pz;
            return c ? c.getLocalBlock(x, y, z-CHUNK_SIZE) : BlockType.STONE;
        }
    }
}