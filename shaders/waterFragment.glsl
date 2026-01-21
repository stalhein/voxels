#version 300 es
precision highp float;

out vec4 FragColor;

flat in uint NormalIndex;
flat in uint BlockType;
in vec3 LocalPos;
in vec3 WorldPos;

uniform vec3 uCameraPos;
uniform sampler2D uAtlas;
uniform float uTime;

// Constants
const vec3 lightDir = normalize(vec3(-0.5, 0.5, -0.7));
const vec3 lightColor = vec3(1.0, 1.0, 0.9);
const float ambientStrength = 0.12;

const vec3 fogColor = vec3(0.7, 0.8, 1.0);
const float fogDensity = 0.05;

vec3 normals[6] = vec3[6](
    vec3(-1.0, 0.0, 0.0),
    vec3(1.0, 0.0, 0.0),
    vec3(0.0, -1.0, 0.0),
    vec3(0.0, 1.0, 0.0),
    vec3(0.0, 0.0, -1.0),
    vec3(0.0, 0.0, 1.0)
);

vec3 getBlockColor(uint i) {
    if (i == 1u) return vec3(0.3, 0.5, 0.2);
    
    return vec3(0.5, 0.2, 0.1);
}

vec2 getUV() {
    vec2 UV;

    if (NormalIndex == 0u || NormalIndex == 1u) {
        UV = fract(LocalPos.zy);
    } else if (NormalIndex == 2u || NormalIndex == 3u) {
        UV = fract(LocalPos.xz);
    } else {
        UV = fract(LocalPos.xy);
    }

    return UV;
}

vec2 getTile() {
    uint x = (BlockType-1u) % 7u;
    uint y = (BlockType-1u) / 7u;
    return vec2(x, y);
}

void main() {
    // Albedo
    const float TILE_SIZE = 1.0 / 7.0;

    vec2 UV = getUV();

    vec2 tile = getTile();
    vec2 normalizedTile = tile * TILE_SIZE;

    vec2 localUV = normalizedTile + UV * TILE_SIZE;

    vec4 objectColor = texture(uAtlas, localUV).rgba;

    objectColor = pow(objectColor, vec4(2.2));

    // Lighting
    vec3 normal = normalize(normals[NormalIndex]);
    float diff = max(dot(normal, lightDir), 0.0);

    vec3 ambient = ambientStrength * lightColor;
    vec3 diffuse = diff * lightColor;

    // Specular
    vec3 viewDirection = normalize(uCameraPos - WorldPos);
    vec3 reflectDirection = reflect(-lightDir, normal);

    float specular = pow(max(dot(viewDirection, reflectDirection), 0.0), 32.0);

    // Fog
    float distance = length(WorldPos.xz - uCameraPos.xz) * 0.005;

    float fogFactor = 1.0 - exp(-distance * distance);    
    fogFactor = clamp(fogFactor, 0.0, 1.0);

    float fogHeightFactor = clamp((WorldPos.y - uCameraPos.y) * 0.004 + 0.9, 0.0, 1.0);
    fogFactor *= fogHeightFactor;

    vec3 finalColor = (ambient + diffuse) * objectColor.rgb + specular;

    finalColor = mix(finalColor, fogColor, fogFactor);

    // Gamma correction
    finalColor = pow(finalColor, vec3(1.0 / 2.2));

    FragColor = vec4(finalColor, objectColor.a);
}