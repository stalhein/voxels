import {mat4, vec3} from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";

const CHUNK_SIZE = 16;
const CHUNK_VOLUME = CHUNK_SIZE ** 3;

const BlockType = {
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

        this.dirty = false;
        this.needsUploading = false;

        this.world = world;

        this.blocks = new Int8Array(CHUNK_VOLUME);

        this.vbo = null;
        this.vao = null;

        this.vertices = [];

        this.heightMap = new Int8Array(CHUNK_SIZE * CHUNK_SIZE);
    }

    async init() {
        mat4.translate(this.model, this.model, vec3.fromValues(this.chunkX*CHUNK_SIZE, this.chunkY*CHUNK_SIZE, this.chunkZ*CHUNK_SIZE));

        this.generateHeights();
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

                    if (this.world.biomeNoise.GetNoise(x + this.chunkX * CHUNK_SIZE, z + this.chunkZ * CHUNK_SIZE) >= 0.5)  this.blocks[this.idx(x, y, z)] = BlockType.STONE;
                    else    this.blocks[this.idx(x, y, z)] = BlockType.GRASS;
                    /*if (realY >= height - 1)   this.blocks[this.idx(x, y, z)] = BlockType.GRASS;
                    else if (realY >= height - 2)   this.blocks[this.idx(x, y, z)] = BlockType.DIRT;
                    else    this.blocks[this.idx(x, y, z)] = BlockType.STONE;*/
                }
            }
        }

        this.dirty = true;
    }

    getHeight(x, z) {
        const wx = x + this.chunkX * CHUNK_SIZE;
        const wz = z + this.chunkZ * CHUNK_SIZE;

        const selectorValue = (this.world.biomeNoise.GetNoise(wx, wz) + 1) * 0.5;

        const islandsHeight = this.getIslandsHeight(wx, wz);
        const plainsHeight = this.getPlainsHeight(wx, wz);
        const mountainsHeight = this.getMountainsHeight(wx, wz);

        const smoothStep = selectorValue * selectorValue * (3 - 2 * selectorValue);

        return plainsHeight + (mountainsHeight - plainsHeight) * smoothStep;
    }

    getIslandsHeight(wx, wz) {
        const noiseValue = (this.world.terrainNoise.GetNoise(wx, wz) + 1) * 0.5;

        return 2 + noiseValue * 14;
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

    async generateMesh() {
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

                        const a = this.getLocalBlock(x, y, z);
                        const b = this.getBlock(nx, ny, nz);

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

                        this.addQuad(axis, direction, normal, d, u, v, w, h, blockType);

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

    addQuad(axis, direction, normal, d, u, v, w, h, blockType) {
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

        const v0 = this.packVertex(x, y, z, normal, blockType);
        const v1 = this.packVertex(x + ux, y + uy, z + uz, normal, blockType);
        const v2 = this.packVertex(x + ux + vx, y + uy + vy, z + uz + vz, normal, blockType);
        const v3 = this.packVertex(x + vx, y + vy, z + vz, normal, blockType);

        if (direction == 1)    this.vertices.push(v0, v1, v2, v0, v2, v3);
        else    this.vertices.push(v0, v2, v1, v0, v3, v2);
    }

    getLocalBlock(x, y, z) {
        if (!this.inBounds(x, y, z)) { return BlockType.AIR; }
        
        return this.blocks[this.idx(x, y, z)];
    }

    getBlock(x, y, z) {
        return this.world.getBlockAtWorld(this.chunkX * CHUNK_SIZE + x, this.chunkY * CHUNK_SIZE + y, this.chunkZ * CHUNK_SIZE + z);
    }
}