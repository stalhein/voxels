#version 440 core
out vec4 FragColor;

uniform vec3 uPlayerPosition;

in vec3 Normal;
in vec3 Position;
flat in uint BlockType;

const vec3 lightDir = normalize(vec3(0.2, 0.8, 0.3));
const vec3 lightColor = vec3(1.0);
const float ambientStrength = 0.4;

void main()
{
    float diff = max(dot(Normal, lightDir), 0.0);

    vec3 ambient = ambientStrength * lightColor;
    vec3 diffuse = diff * lightColor;

    vec3 objectColor = vec3(0.3, 0.7, 0.4);
    if (BlockType == 3) objectColor = vec3(0.5, 0.3, 0.1);
    else if (BlockType == 4)    objectColor = vec3(0.7, 0.6, 0.5);
    else if (BlockType == 1)    objectColor = vec3(0.1, 0.2, 0.8);

    vec3 result = (ambient + diffuse) * objectColor;

    const float fogStart = 200.0;
    const float fogEnd = 225.0;
    const float fogLength = fogEnd - fogStart;
    vec3 fogColor = vec3(0.4);

    float dist = length(uPlayerPosition - Position);

    float fogFactor = clamp(
        (dist - fogStart) / (fogEnd - fogStart),
        0.0,
        1.0
    );

    vec3 finalColor = mix(result, fogColor, fogFactor);

    FragColor = vec4(finalColor, 1.0);
}