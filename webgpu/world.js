import { mat4, vec3 } from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";
import {Chunk} from "./chunk.js";
import {Camera} from "./camera.js";

export class World {
    constructor(device, context, format) {
        this.device = device;
        this.context = context;
        this.format = format;
        
        this.chunks = [];

        this.pipeline = null;
        this.cameraBuffer = null;
        this.cameraBindGroup = null;

        this.depthTexture = device.createTexture({
            size: [context.canvas.width, context.canvas.height],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });

        this.renderPassDesc = {
            colorAttachments: [{
                view: undefined,
                clearValue: [0.2, 0.2, 0.25, 1],
                loadOp: "clear",
                storeOp: "store",
            }],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: "clear",
                depthStoreOp: "store",
            }
        };
    }

    async init(shaderUrl) {
        const code = await fetch(shaderUrl).then(r => r.text());
        const module = this.device.createShaderModule({code});

        this.pipeline = this.device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module,
                buffers: [{
                    arrayStride: 16,
                    attributes: [
                        {shaderLocation: 0, offset: 0, format: "float32x3"},
                        {shaderLocation: 1, offset: 12, format: "uint32"}
                    ]
                }]
            },
            fragment: {
                module,
                targets: [{format: this.format}]
            },
            primitive: {
                topology: "triangle-list",
                cullMode: "back",
            },
            depthStencil: {
                format: "depth24plus",
                depthWriteEnabled: true,
                depthCompare: "less"
            }
        });

        this.cameraBuffer = this.device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.cameraBindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [{
                binding: 0,
                resource: {buffer: this.cameraBuffer}
            }]
        });
    }

    addChunk(chunk) {
        this.chunks.push(chunk);
    }

    render(camera) {
        const view = camera.getViewMatrix();
        
        const proj = mat4.create();
        mat4.perspective(
            proj,
            Math.PI / 3,
            this.context.canvas.width / this.context.canvas.height,
            0.01, 100.0
        );

        const viewProj = mat4.create();
        mat4.multiply(viewProj, proj, view);

        this.device.queue.writeBuffer(
            this.cameraBuffer,
            0,
            viewProj
        );

        this.renderPassDesc.colorAttachments[0].view = this.context.getCurrentTexture().createView();

        const encoder = this.device.createCommandEncoder();
        const pass = encoder.beginRenderPass(this.renderPassDesc);

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.cameraBindGroup);

        for (const chunk of this.chunks) {
            chunk.draw(pass);
        }

        pass.end();
        this.device.queue.submit([encoder.finish()]);
    }
}