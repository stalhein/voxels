#version 440 core
layout (location = 0) in uint aVertex;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

out vec3 Normal;

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
    uint y = (aVertex >> 5) & 31;
    uint z = (aVertex >> 10) & 31;
    uint normalIndex = (aVertex >> 15) & 7;

    vec3 normal = normals[normalIndex];
    Normal = normal;
    
    gl_Position = uProjection * uView * uModel * vec4(x, y, z, 1.0);
}