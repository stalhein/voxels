#version 300 es
precision highp float;
precision highp int;

layout(location = 0) in uint aVertex;

flat out uint NormalIndex;

uniform mat4 uView;
uniform mat4 uProjection;
uniform mat4 uModel;

void main() {
    uint x = aVertex & 31u;
    uint y = (aVertex >> 5) & 31u;
    uint z = (aVertex >> 10) & 31u;
    uint normalIndex = (aVertex >> 15) & 7u;

    gl_Position = uProjection * uView * uModel * vec4(x, y, z, 1.0);
    NormalIndex = normalIndex;
}