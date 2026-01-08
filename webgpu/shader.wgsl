struct Camera {
    viewProj : mat4x4<f32>
};

@group(0) @binding(0)
var<uniform> camera: Camera;

struct VertexIn {
    @location(0) pos : vec3f,
    @location(1) normalIndex : u32,
};

struct VertexOut {
    @builtin(position) position : vec4f,
    @location(0) normal : vec3f,
};

const normals = array<vec3f, 6>(
    vec3f(-1.0, 0.0, 0.0),
    vec3f( 1.0, 0.0, 0.0),
    vec3f(0.0, -1.0, 0.0),
    vec3f(0.0,  1.0, 0.0),
    vec3f(0.0, 0.0, -1.0),
    vec3f(0.0, 0.0,  1.0)
);

@vertex
fn vs(input : VertexIn) -> VertexOut {
    var out : VertexOut;
    out.position = camera.viewProj * vec4f(input.pos, 1.0);
    out.normal = normals[input.normalIndex];

    return out;
}


const lightDir = normalize(vec3f(0.2, 0.8, 0.3));
const lightColor = vec3f(1.0);
const ambientStrength = 0.4;

@fragment
fn fs(input : VertexOut) -> @location(0) vec4f {
    let diff = max(dot(input.normal, lightDir), 0.0);
    
    let ambient = ambientStrength * lightColor;
    let diffuse = diff * lightColor;

    let objectColor = vec3f(0.3, 0.7, 0.4);

    let result = (ambient + diffuse) * objectColor;

    let color = result;
    return vec4f(color, 1.0);
}