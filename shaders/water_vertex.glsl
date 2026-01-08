#version 440 core
layout (location = 0) in uint aVertex;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

out vec3 Normal;
out vec3 Position;
flat out uint BlockType;

const vec3 normals[6] = {
    vec3(-1, 0, 0),
    vec3(1, 0, 0),
    vec3(0, -1, 0),
    vec3(0, 1, 0),
    vec3(0, 0, -1),
    vec3(0, 0, 1)
};

void main()
{
    uint x = aVertex & 31;
    float y = ((aVertex >> 5) & 31) - 0.2;
    uint z = (aVertex >> 10) & 31;
    uint normalIndex = (aVertex >> 15) & 7;
    uint blockType = (aVertex >> 18) & 255;

    vec3 normal = normals[normalIndex];
    Normal = normal;

    vec3 pos = vec3(uModel * vec4(x, y, z, 1.0));
    
    gl_Position = uProjection * uView * vec4(pos, 1.0);
    Position = pos;
    BlockType = blockType;
}