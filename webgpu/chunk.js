import { mat4, vec3 } from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";

const faces = new Int8Array([
    // Left
    0, 0, 0, 0,
    0, 1, 1, 0,
    0, 1, 0, 0,

    0, 0, 0, 0,
    0, 0, 1, 0,
    0, 1, 1, 0,

    // Right
    1, 0, 0, 1,
    1, 1, 0, 1,
    1, 1, 1, 1,

    1, 0, 0, 1,
    1, 1, 1, 1,
    1, 0, 1, 1,

    // Bottom
    0, 0, 0, 2,
    1, 0, 0, 2,
    1, 0, 1, 2,

    0, 0, 0, 2,
    1, 0, 1, 2,
    0, 0, 1, 2,

    // Top
    0, 1, 0, 3,
    1, 1, 1, 3,
    1, 1, 0, 3,

    0, 1, 0, 3,
    0, 1, 1, 3,
    1, 1, 1, 3,

    // Back
    0, 0, 0, 4,
    1, 1, 0, 4,
    1, 0, 0, 4,

    0, 0, 0, 4,
    0, 1, 0, 4,
    1, 1, 0, 4,

    // Front
    0, 0, 1, 5,
    1, 0, 1, 5,
    1, 1, 1, 5,

    0, 0, 1, 5,
    1, 1, 1, 5,
    0, 1, 1, 5
]);

export class Chunk {
    constructor(device) {
        this.device = device;

        this.vertexCount = 36;

        const vertexData = new ArrayBuffer(this.vertexCount * 16);
        const vertexFloats = new Float32Array(vertexData);
        const vertexInts = new Int32Array(vertexData);

        for (let i = 0; i < this.vertexCount; ++i) {
            vertexFloats[i*4+0] = faces[i*4+0];
            vertexFloats[i*4+1] = faces[i*4+1];
            vertexFloats[i*4+2] = faces[i*4+2];
            vertexInts[i*4+3] = faces[i*4+3];
        }

        this.vertexBuffer = device.createBuffer({
            size: vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });

        device.queue.writeBuffer(this.vertexBuffer, 0, vertexData);
    }

    draw(pass) {
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.draw(this.vertexCount);
    }
}