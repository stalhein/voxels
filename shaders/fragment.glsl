#version 440 core
out vec4 FragColor;

in vec3 Normal;

const vec3 lightDir = normalize(vec3(0.2, 0.8, 0.3));
const vec3 lightColor = vec3(1.0);
const float ambientStrength = 0.4;

void main()
{
    float diff = max(dot(Normal, lightDir), 0.0);

    vec3 ambient = ambientStrength * lightColor;
    vec3 diffuse = diff * lightColor;

    vec3 objectColor = vec3(0.2, 0.4, 0.5);

    vec3 result = (ambient + diffuse) * objectColor;

    FragColor = vec4(result, 1.0);
}