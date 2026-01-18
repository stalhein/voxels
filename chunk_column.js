import {mat4, vec3} from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";
import {BlockType, Chunk} from "./chunk.js";
import {Constants} from "./constants.js";

const CHUNK_SIZE = 16;

export class ChunkColumn {
    constructor(gl, world, x, z) {
        this.gl = gl;

        this.world = world;

        this.cx = x;
        this.cz = z;

        this.model = mat4.create();

        this.chunks = new Array(8).fill(null);

        this.heightMap = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);

        this.solidVao = null;
        this.solidVbo = null;
        this.waterVao = null;
        this.waterVbo = null;
    }

    init() {
        mat4.translate(this.model, this.model, vec3.fromValues(this.cx*CHUNK_SIZE, 0, this.cz*CHUNK_SIZE));

        this.loadHeights();

        for (let y = 0; y < Constants.RENDER_HEIGHT; ++y) {
            this.addChunkAt(y);
        }

        const gl = this.gl;

        // Solid
        this.solidVao = gl.createVertexArray();
        this.solidVbo = gl.createBuffer();

        gl.bindVertexArray(this.solidVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.solidVbo);

        gl.bufferData(gl.ARRAY_BUFFER, Constants.MAX_VERTS_PER_CHUNK * Constants.RENDER_HEIGHT * 4, gl.DYNAMIC_DRAW);

        gl.enableVertexAttribArray(0);
        gl.vertexAttribIPointer(0, 1, gl.UNSIGNED_INT, 4, 0);

        // Water
        this.waterVao = gl.createVertexArray();
        this.waterVbo = gl.createBuffer();

        gl.bindVertexArray(this.waterVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.waterVbo);

        gl.bufferData(gl.ARRAY_BUFFER, Constants.MAX_VERTS_PER_CHUNK * Constants.RENDER_HEIGHT * 4, gl.DYNAMIC_DRAW);

        gl.enableVertexAttribArray(0);
        gl.vertexAttribIPointer(0, 1, gl.UNSIGNED_INT, 4, 0);

        gl.bindVertexArray(null);
    }

    update() {
        for (const chunk of this.chunks) {
            if (!chunk || !chunk.dirty) continue;
            chunk.generateMesh();
            chunk.uploadMesh();
        }
    }

    renderSolid(shader) {
        const gl = this.gl;
        gl.bindVertexArray(this.solidVao);

        shader.setMat4("uModel", this.model);

        for (const chunk of this.chunks) {
            if (!chunk || chunk.solidCount == 0) continue;

            gl.drawArrays(gl.TRIANGLES, chunk.solidOffset, chunk.solidCount);
        }
    }

    renderWater(shader, playerPos) {
        const gl = this.gl;
        gl.bindVertexArray(this.waterVao);

        shader.setMat4("uModel", this.model);

        for (const chunk of this.chunks) {
            if (!chunk || chunk.waterCount == 0) continue;

            gl.drawArrays(gl.TRIANGLES, chunk.waterOffset, chunk.waterCount);
        }
    }

    // Heightmap stuff
    loadHeights() {
        for (let x = 0; x < CHUNK_SIZE; ++x) {
            for (let z = 0; z < CHUNK_SIZE; ++z) {
                const height = this.getHeight(x, z);
                this.heightMap[x * CHUNK_SIZE + z] = height;
            }
        }
    }

    getHeight(x, z) {
        const wx = x + this.cx * CHUNK_SIZE;
        const wz = z + this.cz * CHUNK_SIZE;

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

    // Helpers
    addChunkAt(y) {
        const chunk = new Chunk(this.gl, this.world, this, this.cx, y, this.cz);
        this.chunks[y] = chunk;
        chunk.init();
        chunk.generateTerrain();
    }

    getChunk(cy) {
        if (cy < 0 || cy >= Constants.RENDER_HEIGHT)  return null;
        return this.chunks[cy] ? this.chunks[cy] : null;
    }

    getBlock(cy, x, y, z) {
        const chunk = this.getChunk(cy);
        if (!chunk) return BlockType.AIR;
        return chunk.getBlock(x, y, z);
    }

    setBlock(cy, x, y, z, block) {
        const chunk = this.getChunk(cy);
        if (!chunk) return;
        return chunk.setBlock(x, y, z, block);
    }
}