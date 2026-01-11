import {mat4, vec3} from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";
import {Chunk} from "./chunk.js";
import {Shader} from "./shader.js";
import {Texture} from "./texture.js";
import FastNoiseLite from "./FastNoiseLite.js";

const CHUNK_SIZE = 16;

export class World {
    constructor(gl) {
        this.gl = gl;
        
        this.projection = mat4.create();
        
        this.shader = null;
        this.textureAtlas = null;

        this.chunks = new Map();

        this.oldPlayerChunk = vec3.create();

        this.continentalNoise = new FastNoiseLite();
        this.temperatureNoise = new FastNoiseLite();
        this.humidityNoise = new FastNoiseLite();
    }

    async init() {
        this.shader = new Shader(this.gl, "shaders/vertex.glsl", "shaders/fragment.glsl");
        await this.shader.load();

        this.textureAtlas = new Texture(this.gl, "assets/atlas.png");
        await this.textureAtlas.load();

        this.oldPlayerChunk = [1000, 100000, 10000];
        

        this.continentalNoise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
        this.continentalNoise.SetFrequency(0.00015);

        this.temperatureNoise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
        this.continentalNoise.SetFrequency(0.0003);

        this.humidityNoise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
        this.continentalNoise.SetFrequency(0.0003);
    }

    update(width, height, playerPos) {
        mat4.perspective(
            this.projection,
            Math.PI / 3,
            width / height,
            0.1,
            1000.0
        );

        const cx = Math.floor(playerPos[0]/CHUNK_SIZE);
        const cz = Math.floor(playerPos[2]/CHUNK_SIZE);

        const RENDER_RADIUS = 16;

        if (cx != this.oldPlayerChunk[0] || cz != this.oldPlayerChunk[2]) {
            this.oldPlayerChunk[0] = cx;
            this.oldPlayerChunk[2] = cz;

            for (let x = cx-RENDER_RADIUS; x <= cx+RENDER_RADIUS; ++x) {
                for (let z = cz-RENDER_RADIUS; z <= cz+RENDER_RADIUS; ++z) {
                    const dx = x - cx;
                    const dz = z - cz;
                    if (dx * dx + dz * dz <= RENDER_RADIUS * RENDER_RADIUS) {
                        for (let y = 0; y < 4; ++y) {
                            if (this.getChunkAt(x, y, z))   continue;
                            this.addChunkAt(x, y, z);
                        }
                    }
                }
            }

            for (const [key, chunk] of this.chunks) {
                const dx = chunk.chunkX - cx;
                const dz = chunk.chunkZ - cz;
                if (dx * dx + dz * dz > RENDER_RADIUS * RENDER_RADIUS) {
                    if (chunk.vao)  this.gl.deleteVertexArray(chunk.vao);
                    if (chunk.vbo)  this.gl.deleteBuffer(chunk.vbo);
                    this.chunks.delete(key);
                }
            }
        }

        const MAX_JOBS = 8;

        let jobs = 0;
        for (const chunk of this.chunks.values()) {
            if (chunk.dirty) {
                jobs++;
                chunk.generateMesh();
            }
            if (jobs >= MAX_JOBS)   break;
        }

        for (const chunk of this.chunks.values()) {
            if (chunk.needsUploading)   chunk.uploadMesh();
        }
    }

    render(camera) {
        this.shader.use();

        const view = camera.getViewMatrix();
        this.textureAtlas.bind();
        this.shader.setInt("uAtlas", 0);
        this.shader.setMat4("uProjection", this.projection);
        this.shader.setMat4("uView", view);

        for (const chunk of this.chunks.values()) {
            this.shader.setMat4("uModel", chunk.model);
            chunk.render();
        }
    }

    getChunkKey(x, y, z) {
        return `${x},${y},${z}`;
    }

    addChunkAt(x, y, z) {
        const chunk = new Chunk(this.gl, this, x, y, z);
        chunk.init();
        this.chunks.set(this.getChunkKey(x, y, z), chunk);

        const NEIGHBOURS = [
            [-1, 0, 0],
            [1, 0, 0],
            [0, -1, 0],
            [0, 1, 0],
            [0, 0, -1],
            [0, 0, 1]
        ];

        for (const n of NEIGHBOURS) {
            const chunk = this.getChunkAt(x + n[0], y + n[1], z + n[2]);
            if (chunk)  chunk.dirty = true;
        }
    }

    getChunkAt(x, y, z) {
        return this.chunks.get(this.getChunkKey(x, y, z)) || null;
    }

    getChunkAtWorld(x, y, z) {
        const chunkX = Math.floor(x/CHUNK_SIZE);
        const chunkY = Math.floor(y/CHUNK_SIZE);
        const chunkZ = Math.floor(z/CHUNK_SIZE);
        return this.getChunkAt(chunkX, chunkY, chunkZ);
    }

    getBlockAtWorld(x, y, z) {
        const chunkX = Math.floor(x/CHUNK_SIZE);
        const chunkY = Math.floor(y/CHUNK_SIZE);
        const chunkZ = Math.floor(z/CHUNK_SIZE);
        
        const chunk = this.getChunkAtWorld(x, y, z);

        const localX = x - chunkX * CHUNK_SIZE;
        const localY = y - chunkY * CHUNK_SIZE;
        const localZ = z - chunkZ * CHUNK_SIZE;

        return chunk == null || chunk.getLocalBlock(localX, localY, localZ);
    }
}