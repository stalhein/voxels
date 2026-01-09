#version 300 es
precision highp float;

out vec4 FragColor;

flat in uint NormalIndex;

vec3 normals[6] = vec3[6](
    vec3(-1.0, 0.0, 0.0),
    vec3(1.0, 0.0, 0.0),
    vec3(0.0, -1.0, 0.0),
    vec3(0.0, 1.0, 0.0),
    vec3(0.0, 0.0, -1.0),
    vec3(0.0, 0.0, 1.0)
);

void main() {
    const vec3 lightDir = normalize(vec3(-0.2, 0.8, -0.3));
    const vec3 lightColor = vec3(1.0);
    const float ambientStrength = 0.6;

    vec3 normal = normalize(normals[NormalIndex]);
    float diff = max(dot(normal, lightDir), 0.0);

    vec3 ambient = ambientStrength * lightColor;
    vec3 diffuse = diff * lightColor;

    vec3 objectColor = vec3(0.3, 0.5, 0.2);

    vec3 finalColor = (ambient + diffuse) * objectColor;

    FragColor = vec4(finalColor, 1.0);
}