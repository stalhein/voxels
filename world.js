import {mat4, vec3} from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";
import {Chunk} from "./chunk.js";
import {Shader} from "./shader.js";
import {Texture} from "./texture.js";
import FastNoiseLite from "./FastNoiseLite.js";

const CHUNK_SIZE = 16;

export const BiomeType = {
    ISLANDS: 0,
    PLAINS: 1,
    MOUNTAINS: 2
};

export class World {
    constructor(gl) {
        this.gl = gl;
        
        this.projection = mat4.create();
        
        this.shader = null;
        this.textureAtlas = null;

        this.chunks = new Map();
        this.activeChunks = new Set();

        this.oldPlayerChunk = vec3.create();

        this.biomeNoise = new FastNoiseLite();
        this.terrainNoise = new FastNoiseLite();

        this.meshWorkers = [];
        this.freeWorkers = [];
        this.MAX_MESH_JOBS = Math.max(6, navigator.hardwareConcurrency-1);

        this.chunkCreationQueue = [];
        this.meshQueue = [];
    }

    async init() {
        this.shader = new Shader(this.gl, "shaders/vertex.glsl", "shaders/fragment.glsl");
        await this.shader.load();

        this.textureAtlas = new Texture(this.gl, "assets/atlas.png");
        await this.textureAtlas.load();

        this.oldPlayerChunk = [1000, 100000, 10000];
        

        this.biomeNoise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
        this.biomeNoise.SetFrequency(0.0008);

        this.terrainNoise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
        this.terrainNoise.SetFrequency(0.008);
        this.terrainNoise.SetFractalType(FastNoiseLite.FractalType.FBm);
        this.terrainNoise.SetFractalOctaves(4);

        for (let i = 0; i < this.MAX_MESH_JOBS; ++i) {
            const meshWorker = new Worker("./mesher.js", {type: "module"});

            meshWorker.onmessage = (e) => {
                try {
                    const chunkData = e.data;
                    if (!chunkData)  return;

                    const {key, vertices} = chunkData;
                    const chunk = this.chunks.get(key);

                    if (chunk && this.activeChunks.has(key)) {
                        chunk.vertices = vertices;
                        chunk.dirty = false;
                        chunk.needsUploading = true;
                        chunk.meshing = false;
                    }
                } finally {
                    this.freeWorkers.push(meshWorker);
                    this.sendJobs();
                }
            }

            this.meshWorkers.push(meshWorker);
            this.freeWorkers.push(meshWorker);
        }

    }

    sendJobs() {
        while (this.freeWorkers.length > 0 && this.meshQueue.length > 0) {
            const meshWorker = this.freeWorkers.pop();
            const job = this.meshQueue.shift();
            meshWorker.postMessage(job);
        }
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
        const RENDER_HEIGHT = 8;

        if (cx != this.oldPlayerChunk[0] || cz != this.oldPlayerChunk[2]) {
            this.oldPlayerChunk[0] = cx;
            this.oldPlayerChunk[2] = cz;

            for (let x = cx-RENDER_RADIUS; x <= cx+RENDER_RADIUS; ++x) {
                for (let z = cz-RENDER_RADIUS; z <= cz+RENDER_RADIUS; ++z) {
                    const dx = x - cx;
                    const dz = z - cz;
                    if (dx * dx + dz * dz <= RENDER_RADIUS * RENDER_RADIUS) {
                        for (let y = 0; y < RENDER_HEIGHT; ++y) {
                            const key = this.getChunkKey(x, y, z);
                            if (!this.activeChunks.has(key)) {
                                this.chunkCreationQueue.push([x, y, z]);
                            }
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
                    this.activeChunks.delete(key);
                }
            }
        }

        const MAX_CREATION_JOBS = 16;
        this.chunkCreationQueue.sort((a, b) => {
            const adx = cx - a[0];
            const adz = cz - a[2];
            const bdx = cx - b[0];
            const bdz = cz - b[2];

            return (adx*adx+adz*adz) - (bdx*bdx+bdz+bdz);
            
        });
        for (let i = 0; i < MAX_CREATION_JOBS && this.chunkCreationQueue.length; ++i) {
            const [x, y, z] = this.chunkCreationQueue.shift();
            const key = this.getChunkKey(x, y, z);
            const dx = x - cx;
            const dz = z - cz;
            if (!this.activeChunks.has(key) && dx*dx+dz*dz <= RENDER_RADIUS*RENDER_RADIUS) {
                this.addChunkAt(x, y, z);
                this.activeChunks.add(key);
            }
        }

        for (const chunk of this.chunks.values()) {
            if (chunk.needsTerraining) {
                chunk.generateTerrain();
            }

            if (chunk.dirty && !chunk.meshing) {
                chunk.meshing = true;
                
                this.meshQueue.push({
                        key: this.getChunkKey(chunk.chunkX, chunk.chunkY, chunk.chunkZ),
                        cx: chunk.chunkX,
                        cz: chunk.chunkZ,
                        blocks: chunk.blocks,
                        neighbors: this.getNeighborBlocks(chunk)
                });
            }
        }
        this.sendJobs();

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
            if (!chunk.vao) continue;
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
            if (chunk)  {chunk.dirty = true; chunk.meshing = false;}
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

        return chunk || chunk.getLocalBlock(localX, localY, localZ);
    }

    getNeighborBlocks(chunk) {
        const neighbors = {
            nx: this.getChunkAt(chunk.chunkX-1, chunk.chunkY, chunk.chunkZ)?.blocks,
            px: this.getChunkAt(chunk.chunkX+1, chunk.chunkY, chunk.chunkZ)?.blocks,
            ny: this.getChunkAt(chunk.chunkX, chunk.chunkY-1, chunk.chunkZ)?.blocks,
            py: this.getChunkAt(chunk.chunkX, chunk.chunkY+1, chunk.chunkZ)?.blocks,
            nz: this.getChunkAt(chunk.chunkX, chunk.chunkY, chunk.chunkZ-1)?.blocks,
            pz: this.getChunkAt(chunk.chunkX, chunk.chunkY, chunk.chunkZ+1)?.blocks
        };

        return neighbors;
    }
}