import { mat4, vec3 } from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";

export class Camera {
    constructor() {
        this.position = vec3.fromValues(0, 10, 10);
        this.pitch = 0;
        this.yaw = Math.PI;
        this.speed = 30;
        this.sensitivity =  0.004;

        this.keys = {};
        window.addEventListener("keydown", e => this.keys[e.key.toLowerCase()] = true);
        window.addEventListener("keyup", e => this.keys[e.key.toLowerCase()] = false);

        window.addEventListener("mousemove", e => {
            if (document.pointerLockElement) {
                this.yaw -= e.movementX * this.sensitivity;
                this.pitch -= e.movementY * this.sensitivity;
                
                const MAX_PITCH = Math.PI / 2 - 0.001;

                this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
            }
        });

        document.addEventListener("click", () => {
            document.body.requestPointerLock();
        });
    }

    getViewMatrix() {
        const forward = vec3.fromValues(
            Math.cos(this.pitch) * Math.sin(this.yaw),
            Math.sin(this.pitch),
            Math.cos(this.pitch) * Math.cos(this.yaw)
        );

        const target = vec3.create();
        vec3.add(target, this.position, forward);

        const view = mat4.create();
        mat4.lookAt(view, this.position, target, [0, 1, 0]);
        return view;
    }

    update(dt) {
        const forward = vec3.fromValues(
            Math.sin(this.yaw),
            0,
            Math.cos(this.yaw),
        );

        const right = vec3.fromValues(
            Math.cos(this.yaw),
            0,
            -Math.sin(this.yaw),
        );

        if (this.keys["w"]) vec3.scaleAndAdd(this.position, this.position, forward, this.speed * dt);
        if (this.keys["s"]) vec3.scaleAndAdd(this.position, this.position, forward, -this.speed * dt);
        if (this.keys["a"]) vec3.scaleAndAdd(this.position, this.position, right, this.speed * dt);
        if (this.keys["d"]) vec3.scaleAndAdd(this.position, this.position, right, -this.speed * dt);
        if (this.keys[" "]) this.position[1] += this.speed * dt;
        if (this.keys["shift"]) this.position[1] -= this.speed * dt;
    }
};