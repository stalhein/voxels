let device;
let context;
let pipeline;
let renderPassDescriptor;
let observer;



async function main() {
    const adapter = await navigator.gpu?.requestAdapter();
    device = await adapter?.requestDevice();
    if (!device) {
        console.error("WebGPU not supported in this browser.");
        return;
    }

    const canvas = document.querySelector("canvas");
    context = canvas.getContext("webgpu");
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device,
        format: presentationFormat,
    });

    const module = device.createShaderModule({
        lable: "Hardcoded red triangle shaders.",
        code:`
            struct OurVertexShaderOutput {
                @builtin(position) position: vec4f,
                @location(0) color: vec4f,
            };

            @vertex fn vs(
                @builtin(vertex_index) vertexIndex: u32
            ) -> OurVertexShaderOutput {
                let pos = array(
                    vec2f( 0.0,  0.5),
                    vec2f(-0.5, -0.5),
                    vec2f( 0.5, -0.5)
                );

                var color = array<vec4f, 3>(
                    vec4f(1, 0, 0, 1),
                    vec4f(0, 1, 0, 1),
                    vec4f(0, 0, 1, 1),
                );

                var vsOutput: OurVertexShaderOutput;
                vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
                vsOutput.color = color[vertexIndex];
                return vsOutput;
            }

            @fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
                return fsInput.color;
            }
        `,
    });

    pipeline = device.createRenderPipeline({
        label: "Red triangle pipeline.",
        layout: "auto",
        vertex: {
            module,
        },
        fragment: {
            module,
            targets: [{ format: presentationFormat }],
        },
    });

    renderPassDescriptor = {
        label: "renderPass",
        colorAttachments: [
            {
                clearValue: [0.3, 0.3, 0.3, 1],
                loadOp: "clear",
                storeOp: "store",
            },
        ],
    };

    function render() {
        renderPassDescriptor.colorAttachments[0].view = context.getCurrentTexture().createView();
        const encoder = device.createCommandEncoder({label: "encoder"});

        const pass = encoder.beginRenderPass(renderPassDescriptor);
        pass.setPipeline(pipeline);
        pass.draw(3);
        pass.end();

        const commandBuffer = encoder.finish();
        device.queue.submit([commandBuffer]);
    }

    observer = new ResizeObserver(entries => {
        for (const entry of entries) {
            const canvas = entry.target;
            const box = entry.contentBoxSize[0];

            const width  = Math.max(1, Math.floor(box.inlineSize));
            const height = Math.max(1, Math.floor(box.blockSize));

            canvas.width  = Math.min(width, device.limits.maxTextureDimension2D);
            canvas.height = Math.min(height, device.limits.maxTextureDimension2D);
        }

        render();
    });
    observer.observe(canvas);

}

main();
