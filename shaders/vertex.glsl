#version 440 core
layout (location = 0) in uint aVertex;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

void main()
{
    uint x = aVertex & 31;
    uint y = (aVertex >> 5) & 31;
    uint z = (aVertex >> 10) & 31;
    
    gl_Position = uProjection * uView * uModel * vec4(x, y, z, 1.0);
}