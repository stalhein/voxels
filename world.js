import {mat4, vec3} from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";
import {Shader} from "./shader.js";
import {Texture} from "./texture.js";
import {ChunkColumn} from "./chunk_column.js";
import FastNoiseLite from "./FastNoiseLite.js";

import {Constants} from "./constants.js";
import { BlockType } from "./chunk.js";


export const BiomeType = {
    ISLANDS: 0,
    PLAINS: 1,
    MOUNTAINS: 2
};

export class World {
    constructor(gl) {
        this.gl = gl;
        
        this.projection = mat4.create();
        
        this.solidShader = null;
        this.waterShader = null;

        this.textureAtlas = null;

        this.oldPlayerChunk = vec3.create();

        this.biomeNoise = new FastNoiseLite();
        this.terrainNoise = new FastNoiseLite();

        this.columns = new Map();

        this.dirtyChunks = [];

        this.currentBlock = null;
        document.addEventListener("mousedown", (event) => {
            if (event.button == 0)   this.breakBlock();
            if (event.button == 2)   this.placeBlock(BlockType.STONE);
        });
        document.addEventListener("contextmenu", (event) => {
            event.preventDefault();
        });
    }

    async init() {
        this.solidShader = new Shader(this.gl, "shaders/solidVertex.glsl", "shaders/solidFragment.glsl");
        await this.solidShader.load();

        this.waterShader = new Shader(this.gl, "shaders/waterVertex.glsl", "shaders/waterFragment.glsl");
        await this.waterShader.load();

        this.textureAtlas = new Texture(this.gl, "assets/atlas.png");
        await this.textureAtlas.load();        

        this.biomeNoise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
        this.biomeNoise.SetFrequency(0.0008);

        this.terrainNoise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
        this.terrainNoise.SetFrequency(0.005);
        this.terrainNoise.SetFractalType(FastNoiseLite.FractalType.FBm);
        this.terrainNoise.SetFractalOctaves(4);

        const lastTime = performance.now();
        for (let x = -Constants.RENDER_RADIUS; x < Constants.RENDER_RADIUS; ++x) {
            for (let z = -Constants.RENDER_RADIUS; z < Constants.RENDER_RADIUS; ++z) {
                if (x * x + z * z <= Constants.RENDER_RADIUS * Constants.RENDER_RADIUS)   this.addColumn(x, z);
            }
        }
        console.log(performance.now() - lastTime);
    }

    update(width, height, playerPosition, playerDirection) {
        mat4.perspective(
            this.projection,
            Math.PI / 3,
            width / height,
            0.1,
            1000.0
        );

        const lastTime = performance.now();
        while (this.dirtyChunks.length > 0) {
            const chunk = this.dirtyChunks.pop();
            chunk.reload();
        }
        if (performance.now() - lastTime > 1)   console.log(performance.now() - lastTime);

        this.currentBlock = this.raycast(playerPosition, playerDirection);
    }

    render(camera, playerPos) {
        const view = camera.getViewMatrix();

        this.solidShader.use();
        this.textureAtlas.bind();
        this.solidShader.setInt("uAtlas", 0);
        this.solidShader.setMat4("uProjection", this.projection);
        this.solidShader.setMat4("uView", view);
        this.solidShader.setVec3("uCameraPos", playerPos);

        for (const column of this.columns) {
            column[1].renderSolid(this.solidShader);
        }


        this.waterShader.use();
        this.textureAtlas.bind();
        this.waterShader.setInt("uAtlas", 0);
        this.waterShader.setMat4("uProjection", this.projection);
        this.waterShader.setMat4("uView", view);
        this.waterShader.setFloat("uTime", performance.now());
        this.waterShader.setVec3("uCameraPos", playerPos);

        for (const column of this.columns) {
            column[1].renderWater(this.waterShader, playerPos);
        }
    }


    raycast(origin, dir) {        
        let direction = vec3.normalize(vec3.create(), dir);

        const MAX_REACH = 15;

        let block = vec3.floor(vec3.create(), origin);

        let step = vec3.fromValues(
            direction[0] > 0 ? 1 : -1,
            direction[1] > 0 ? 1 : -1,
            direction[2] > 0 ? 1 : -1,
        );

        const tMax = vec3.create();
        const tDelta = vec3.create();

        for (let i = 0; i < 3; ++i) {
            if (direction[i] == 0) {
                tMax[i] = Infinity;
                tDelta[i] = Infinity;
            } else {
                const nextBoundary = block[i] + (step[i] > 0 ? 1 : 0);

                tMax[i] = (nextBoundary-origin[i]) / direction[i];
                tDelta[i] = Math.abs(1 / direction[i]);
            }
        }

        let distance = 0;
        let hitNormal = vec3.create();
        while (distance <= MAX_REACH) {
            if (this.getBlock(block[0], block[1], block[2]) != BlockType.AIR && this.getBlock(block[0], block[1], block[2]) != BlockType.WATER) {
                return {
                    block: vec3.clone(block),
                    normal: vec3.clone(hitNormal)
                };
            }

            if (tMax[0] < tMax[1]) {
                if (tMax[0] < tMax[2]) {
                    block[0] += step[0];
                    distance = tMax[0];
                    tMax[0] += tDelta[0];
                    vec3.set(hitNormal, -step[0], 0, 0);
                } else {
                    block[2] += step[2];
                    distance = tMax[2];
                    tMax[2] += tDelta[2];
                    vec3.set(hitNormal, 0, 0, -step[2]);
                }
            } else {
                if (tMax[1] < tMax[2]) {
                    block[1] += step[1];
                    distance = tMax[1];
                    tMax[1] += tDelta[1];
                    vec3.set(hitNormal, 0, -step[1], 0);
                } else {
                    block[2] += step[2];
                    distance = tMax[2];
                    tMax[2] += tDelta[2];
                    vec3.set(hitNormal, 0, 0, -step[2]);
                }
            }
        }

        return null;
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

    getBlock(wx, wy, wz) {
        const cx = Math.floor(wx/Constants.CHUNK_SIZE);
        const cy = Math.floor(wy/Constants.CHUNK_SIZE);
        const cz = Math.floor(wz/Constants.CHUNK_SIZE);

        const x = wx - cx*Constants.CHUNK_SIZE;
        const y = wy - cy*Constants.CHUNK_SIZE;
        const z = wz - cz*Constants.CHUNK_SIZE;

        const column = this.getColumn(cx, cz);

        if (!column)    return BlockType.AIR;

        return column.getBlock(cy, x, y, z);
    }

    breakBlock() {
        if (!this.currentBlock) return;

        const wx = this.currentBlock.block[0];
        const wy = this.currentBlock.block[1];
        const wz = this.currentBlock.block[2];

        const cx = Math.floor(wx/Constants.CHUNK_SIZE);
        const cy = Math.floor(wy/Constants.CHUNK_SIZE);
        const cz = Math.floor(wz/Constants.CHUNK_SIZE);

        const x = wx - cx*Constants.CHUNK_SIZE;
        const y = wy - cy*Constants.CHUNK_SIZE;
        const z = wz - cz*Constants.CHUNK_SIZE;

        const column = this.getColumn(cx, cz);

        if (!column)    return;

        if (wy < Constants.CHUNK_SIZE * 2)   return column.setBlock(cy, x, y, z, BlockType.WATER);
        return column.setBlock(cy, x, y, z, BlockType.AIR);
    }

    placeBlock(block) {
        if (!this.currentBlock) return;

        const wx = this.currentBlock.block[0] + this.currentBlock.normal[0];
        const wy = this.currentBlock.block[1] + this.currentBlock.normal[1];
        const wz = this.currentBlock.block[2] + this.currentBlock.normal[2];

        const cx = Math.floor(wx/Constants.CHUNK_SIZE);
        const cy = Math.floor(wy/Constants.CHUNK_SIZE);
        const cz = Math.floor(wz/Constants.CHUNK_SIZE);

        const x = wx - cx*Constants.CHUNK_SIZE;
        const y = wy - cy*Constants.CHUNK_SIZE;
        const z = wz - cz*Constants.CHUNK_SIZE;

        const column = this.getColumn(cx, cz);

        if (!column)    return;

        return column.setBlock(cy, x, y, z, block);
    }
}