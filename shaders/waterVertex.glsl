#version 300 es
precision highp float;
precision highp int;

layout(location = 0) in uint aVertex;

flat out uint NormalIndex;
flat out uint BlockType;
out vec3 LocalPos;
out vec3 WorldPos;

uniform mat4 uView;
uniform mat4 uProjection;
uniform mat4 uModel;
uniform float uTime;

void main() {
    uint x = aVertex & 31u;
    uint y = (aVertex >> 5) & 31u;
    uint z = (aVertex >> 10) & 31u;
    uint normalIndex = (aVertex >> 15) & 7u;
    uint blockType = (aVertex >> 18) & 15u;
    uint cy = (aVertex >> 22) & 31u;

    float finalY = float(y + cy * 16u);

    gl_Position = uProjection * uView * uModel * vec4(x, finalY, z, 1.0);
    NormalIndex = normalIndex;
    BlockType = blockType;
    LocalPos = vec3(x, y, z);
    WorldPos = vec4(uModel * vec4(x, finalY, z, 1.0)).xyz;
}