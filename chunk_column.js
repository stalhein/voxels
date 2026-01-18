import {BlockType, Chunk} from "./chunk.js";
import {Constants} from "./constants.js";

const CHUNK_SIZE = 16;

export class ChunkColumn {
    constructor(gl, world, x, z) {
        this.gl = gl;

        this.world = world;

        this.cx = x;
        this.cz = z;

        this.chunks = new Array(8).fill(null);

        this.heightMap = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    }

    init() {
        this.loadHeights();

        for (let y = 0; y < Constants.RENDER_HEIGHT; ++y) {
            this.addChunkAt(y);
        }
    }

    update() {
        for (const chunk of this.chunks) {
            if (!chunk || !chunk.dirty) continue;
            chunk.generateMesh();
            chunk.uploadMesh();
        }
    }

    renderSolid(shader) {
        for (const chunk of this.chunks) {
            if(chunk)   chunk.renderSolid(shader);
        }
    }

    renderWater(shader) {
        for (const chunk of this.chunks) {
            if(chunk)   chunk.renderWater(shader);
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