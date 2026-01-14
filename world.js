import {mat4, vec3} from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";
import {Chunk} from "./chunk.js";
import {Shader} from "./shader.js";
import {Texture} from "./texture.js";
import {ChunkColumn} from "./chunk_column.js";
import FastNoiseLite from "./FastNoiseLite.js";

const CHUNK_SIZE = 16;

const RENDER_RADIUS = 12;
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

        this.chunkColumn = new ChunkColumn(gl, this, 0, 0);
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

        this.chunkColumn.init();

    }

    update(width, height, playerPos) {
        mat4.perspective(
            this.projection,
            Math.PI / 3,
            width / height,
            0.1,
            1000.0
        );
    }

    render(camera) {
        this.shader.use();

        const view = camera.getViewMatrix();
        this.textureAtlas.bind();
        this.shader.setInt("uAtlas", 0);
        this.shader.setMat4("uProjection", this.projection);
        this.shader.setMat4("uView", view);

        this.chunkColumn.render(this.shader);
    }
}