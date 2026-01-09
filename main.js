import {mat4} from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";
import {Camera} from "./camera.js"
import {Shader} from "./shader.js";
import {Chunk} from "./chunk.js";

const canvas = document.querySelector("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const gl = canvas.getContext("webgl2");
if (!gl) {
    console.error("WebGL2 not supported.");
}

const camera = new Camera();

const projection = mat4.create();
mat4.perspective(
    projection,
    Math.PI / 3,
    canvas.width / canvas.height,
    0.1,
    1000.0
);

let shader = null;
let vbo, vao;

let lastTime;

async function init() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST);
    //gl.enable(gl.CULL_FACE);
    //gl.cullFace(gl.BACK);

    shader = new Shader(gl, "shaders/vertex.glsl", "shaders/fragment.glsl");
    await shader.load();
}

await init();

const chunk = new Chunk(gl, 0, 0, 0);
await chunk.init();

function render(time) {
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    camera.update(dt);

    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    shader.use();

    const view = camera.getViewMatrix();
    shader.setMat4("uProjection", projection);
    shader.setMat4("uView", view);

    const model = mat4.create();
    shader.setMat4("uModel", model);

    chunk.render();

    requestAnimationFrame(render);
}

render();