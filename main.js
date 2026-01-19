import {Camera} from "./camera.js";
import {World} from "./world.js";
import {Constants} from "./constants.js";

const canvas = document.querySelector("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const gl = canvas.getContext("webgl2");
if (!gl) {
    console.warn("WebGL2 not supported.");
}

const camera = new Camera();
const world = new World(gl);

let lastTime = 0;

async function init() {
    await world.init();

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    lastTime = performance.now();

    requestAnimationFrame(render);
}

function render(time) {
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    camera.update(dt);
    world.update(canvas.width, canvas.height, camera.position, camera.forward);

    gl.clearColor(0.5, 0.65, 0.8, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    world.render(camera, camera.position);

    requestAnimationFrame(render);
}

window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

document.getElementById("value").innerText = document.getElementById("renderSelector").value + " chunks";
document.getElementById("renderSelector").addEventListener("input", () => {
    document.getElementById("value").innerText = document.getElementById("renderSelector").value + " chunks";
    Constants.RENDER_RADIUS = document.getElementById("renderSelector").value;
});

document.getElementById("go").addEventListener("click", () => {
    init();
    document.querySelector("div").style.display = "none";
    document.querySelector("canvas").style.display = "block";
    document.body.requestPointerLock();

    document.addEventListener("click", () => {
        document.body.requestPointerLock();
    });
});