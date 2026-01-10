import {mat4} from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";
import {Chunk} from "./chunk.js";
import {Shader} from "./shader.js";
import {CHUNK_SIZE} from "./constants.js";
import {Texture} from "./texture.js";

export class World {
    constructor(gl) {
        this.gl = gl;
        
        this.projection = mat4.create();
        
        this.shader = null;
        this.textureAtlas = null;

        this.chunks = new Map();
    }

    async init() {
        this.shader = new Shader(this.gl, "shaders/vertex.glsl", "shaders/fragment.glsl");
        await this.shader.load();

        this.textureAtlas = new Texture(this.gl, "assets/atlas.png");
        await this.textureAtlas.load();

        for (let x = 0; x < 1; ++x) {
            for (let y = 0; y < 1; ++y) {
                for (let z = 0; z < 1; ++z) {
                    const chunk = new Chunk(this.gl, this, x, y, z);   
                    await chunk.init();
                    this.chunks.set(this.getChunkKey(x, y, z), chunk);               
                }
            }
        }
    }

    update(width, height) {
        mat4.perspective(
            this.projection,
            Math.PI / 3,
            width / height,
            0.1,
            1000.0
        );

        for (const chunk of this.chunks.values()) {
            if (chunk.dirty) chunk.generateMesh();
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