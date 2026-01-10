import {Camera} from "./camera.js";
import {World} from "./world.js";

const canvas = document.querySelector("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const gl = canvas.getContext("webgl2");
if (!gl) {
    console.error("WebGL2 not supported.");
}

const camera = new Camera();
const world = new World(gl);
await world.init();

let lastTime = performance.now();

function init() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
}

init();

function render(time) {
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    camera.update(dt);
    world.update(canvas.width, canvas.height);

    gl.clearColor(0.5, 0.65, 0.8, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    world.render(camera);

    requestAnimationFrame(render);
}

render();