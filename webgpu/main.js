import {World} from "./world.js";
import {Chunk} from "./chunk.js";
import {Camera} from "./camera.js";

const canvas = document.querySelector("canvas");
let width, height;

async function main() {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu");
    const format = navigator.gpu.getPreferredCanvasFormat();

    function configureCanvas() {
        width = canvas.clientWidth;
        height = canvas.clientHeight;

        canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
        canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));

        context.configure({device, format, alphaMode: "opaque"});

        world.depthTexture = device.createTexture({
            size: [canvas.width, canvas.height],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });

        world.renderPassDesc.depthStencilAttachment.view = world.depthTexture.createView();
    }


    const camera = new Camera();
    const world = new World(device, context, format);
    await world.init("shader.wgsl");
    let chunk = new Chunk(0, 0, 0, device);
    world.addChunk(chunk);
    chunk = new Chunk(1, 0, 0, device);
    world.addChunk(chunk);

    configureCanvas();

    const observer = new ResizeObserver(() => {
        configureCanvas();
    });

    let lastTime = performance.now();
    function loop(now) {
        const dt = (now-lastTime)/1000;
        lastTime = now;

        camera.update(dt);

        world.render(camera);

        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    
}
main();