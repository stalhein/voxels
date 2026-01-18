#version 300 es
precision highp float;

out vec4 FragColor;

flat in uint NormalIndex;
flat in uint BlockType;
in vec3 LocalPos;

uniform sampler2D uAtlas;

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

    // Lighting
    const vec3 lightDir = normalize(vec3(-0.2, 0.8, -0.3));
    const vec3 lightColor = vec3(1.0);
    const float ambientStrength = 0.6;

    vec3 normal = normalize(normals[NormalIndex]);
    float diff = max(dot(normal, lightDir), 0.0);

    vec3 ambient = ambientStrength * lightColor;
    vec3 diffuse = diff * lightColor;


    // Object color
    const float TILE_SIZE = 1.0 / 7.0;

    vec2 UV = getUV();

    vec2 tile = getTile();
    vec2 normalizedTile = tile * TILE_SIZE;

    vec2 localUV = normalizedTile + UV * TILE_SIZE;

    vec4 objectColor = texture(uAtlas, localUV).rgba;


    // Output color
    vec3 finalColor = (ambient + diffuse) * objectColor.rgb;

    FragColor = vec4(finalColor, objectColor.a);
}