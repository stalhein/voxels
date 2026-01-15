import {mat4, vec3} from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";
import {Chunk} from "./chunk.js";
import {Shader} from "./shader.js";
import {Texture} from "./texture.js";
import {ChunkColumn} from "./chunk_column.js";
import FastNoiseLite from "./FastNoiseLite.js";

const CHUNK_SIZE = 16;

const RENDER_RADIUS = 24;
const RENDER_HEIGHT = 8;

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

        this.oldPlayerChunk = vec3.create();

        this.biomeNoise = new FastNoiseLite();
        this.terrainNoise = new FastNoiseLite();

        this.columns = new Map();
    }

    async init() {
        this.shader = new Shader(this.gl, "shaders/vertex.glsl", "shaders/fragment.glsl");
        await this.shader.load();

        this.textureAtlas = new Texture(this.gl, "assets/atlas.png");
        await this.textureAtlas.load();        

        this.biomeNoise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
        this.biomeNoise.SetFrequency(0.0008);

        this.terrainNoise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
        this.terrainNoise.SetFrequency(0.008);
        this.terrainNoise.SetFractalType(FastNoiseLite.FractalType.FBm);
        this.terrainNoise.SetFractalOctaves(4);

        const lastTime = performance.now();
        for (let x = 0; x < RENDER_RADIUS; ++x) {
            for (let z = 0; z < RENDER_RADIUS; ++z) {
                this.addColumn(x, z);
            }
        }
        console.log(performance.now() - lastTime);
    }

    update(width, height) {
        mat4.perspective(
            this.projection,
            Math.PI / 3,
            width / height,
            0.1,
            1000.0
        );

        const lastTime = performance.now();
        for (const column of this.columns) {
            column[1].update();
        }
        if (performance.now() - lastTime > 1)   console.log(performance.now() - lastTime);
    }

    render(camera) {
        this.shader.use();

        const view = camera.getViewMatrix();
        this.textureAtlas.bind();
        this.shader.setInt("uAtlas", 0);
        this.shader.setMat4("uProjection", this.projection);
        this.shader.setMat4("uView", view);

        for (const column of this.columns) {
            column[1].render(this.shader);
        }
    }

    // Helpers
    getChunkKey(cx, cz) {
        return `${cx},${cz}`;
    }

    addColumn(cx, cz) {
        const key = this.getChunkKey(cx, cz);

        let column = this.columns.get(key);
        if (column) return column;

        column = new ChunkColumn(this.gl, this, cx, cz);
        column.init();
        this.columns.set(key, column);
    }

    getColumn(cx, cz) {
        const key = this.getChunkKey(cx, cz);

        let column = this.columns.get(key);
        
        return column;
    }
}