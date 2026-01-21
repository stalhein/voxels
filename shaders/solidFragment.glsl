#version 300 es
precision highp float;

out vec4 FragColor;

flat in uint NormalIndex;
flat in uint BlockType;
in vec3 LocalPos;
in vec3 WorldPos;

uniform sampler2D uAtlas;
uniform vec3 uCameraPos;

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

uint pcg_hash(uint i) {
    uint state = i * 747796405u + 2891336453u;
    uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

void main() {
    // Albedo
    float hash = float(pcg_hash(
        uint(WorldPos.x) * 73856093u ^
        uint(WorldPos.y) * 19349663u ^
        uint(WorldPos.z) * 83492791u
    )) / float(0xffffffffu);

    const float TILE_SIZE = 1.0 / 7.0;

    vec2 UV = getUV();

    vec2 tile = getTile();
    vec2 normalizedTile = tile * TILE_SIZE;

    vec2 localUV = normalizedTile + UV * TILE_SIZE;

    vec3 objectColor = texture(uAtlas, localUV).rgb;

    objectColor = pow(objectColor, vec3(2.2));

    float variation = mix(0.98, 1.02, hash);
    objectColor.rgb *= variation;

    // Lighting
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 normal = normalize(normals[NormalIndex]);

    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = diff * lightColor;

    vec3 ambient = ambientStrength * lightColor;

    // Fog
    float distance = length(WorldPos.xz - uCameraPos.xz) * 0.005;

    float fogFactor = 1.0 - exp(-distance * distance);    
    fogFactor = clamp(fogFactor, 0.0, 1.0);

    float fogHeightFactor = clamp((WorldPos.y - uCameraPos.y) * 0.004 + 0.9, 0.0, 1.0);
    fogFactor *= fogHeightFactor;

    // Output color
    vec3 finalColor = (ambient + diffuse) * objectColor;

    finalColor = mix(finalColor, fogColor, fogFactor);
    
    // Gamma correction
    finalColor = pow(finalColor, vec3(1.0 / 2.2));

    FragColor = vec4(finalColor, 1.0);
}