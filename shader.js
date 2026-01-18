import {mat4, vec3} from "https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js";

export class Shader {
    constructor(gl, vertexPath, fragmentPath) {
        this.gl = gl;
        this.program = null;
        this.vertexPath = vertexPath;
        this.fragmentPath = fragmentPath;
    }

    async load() {
        const gl = this.gl;
        
        const [vsSource, fsSource] = await Promise.all([
            fetch(this.vertexPath).then(r => r.text()),
            fetch(this.fragmentPath).then(r => r.text())
        ]);

        const vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, vsSource);
        gl.compileShader(vs);

        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
            console.error("Vertex shader error: ", gl.getShaderInfoLog(vs));
            gl.deleteShader(vs);
            return;
        }

        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, fsSource);
        gl.compileShader(fs);

        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
            console.error("Fragment shader error: ", gl.getShaderInfoLog(fs));
            gl.deleteShader(fs);
            return;
        }

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("Program shader error: ", gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return;
        }

        gl.deleteShader(vs);
        gl.deleteShader(fs);

        this.program = program;
    }

    use() {
        this.gl.useProgram(this.program);
    }

    setMat4(name, value) {
        const uniform = this.getUniform(name);
        this.gl.uniformMatrix4fv(uniform, false, value);
    }

    setInt(name, value) {
        const uniform = this.getUniform(name);
        this.gl.uniform1i(uniform, value);
    }

    setFloat(name, value) {
        const uniform = this.getUniform(name);
        this.gl.uniform1f(uniform, value);
    }

    setVec3(name, value) {
        const uniform = this.getUniform(name);
        this.gl.uniform3fv(uniform, value);
    }

    getUniform(name) {
        return this.gl.getUniformLocation(this.program, name);
    }
}