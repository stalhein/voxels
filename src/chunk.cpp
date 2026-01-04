#include "chunk.hpp"

constexpr int VOXEL_FACES[] = {
    // Left
    0, 0, 0,
    0, 1, 1,
    0, 1, 0,

    0, 0, 0,
    0, 0, 1,
    0, 1, 1,

    // Right
    1, 0, 0,
    1, 1, 0,
    1, 1, 1,

    1, 0, 0,
    1, 1, 1,
    1, 0, 1,

    // Bottom
    0, 0, 0,
    1, 0, 0,
    1, 0, 1,

    0, 0, 0,
    1, 0, 1,
    0, 0, 1,

    // Top
    0, 1, 0,
    1, 1, 1,
    1, 1, 0,

    0, 1, 0,
    0, 1, 1,
    1, 1, 1,

    // Back
    0, 0, 0,
    1, 1, 0,
    1, 0, 0,

    0, 0, 0,
    0, 1, 0,
    1, 1, 0,

    // Front
    0, 0, 1,
    1, 0, 1,
    1, 1, 1,

    0, 0, 1,
    1, 1, 1,
    0, 1, 1
};

constexpr int ITEMS_PER_VERTEX = 3;
constexpr int VERTICES_PER_FACE = 6;

Chunk::Chunk(int x, int y, int z) : chunkX(x), chunkY(y), chunkZ(z)
{
    model = glm::translate(glm::mat4(1.0f), glm::vec3(chunkX * CHUNK_SIZE, chunkY * CHUNK_SIZE, chunkZ * CHUNK_SIZE));

    glGenBuffers(1, &vbo);
    glGenVertexArrays(1, &vao);
    glBindVertexArray(vao);
    glBindBuffer(GL_ARRAY_BUFFER, vbo);

    glVertexAttribIPointer(0, 1, GL_UNSIGNED_INT, sizeof(uint32_t), (void*)0);
    glEnableVertexAttribArray(0);
}

void Chunk::generateTerrain(FastNoiseLite* noise)
{
    blocks.fill(0);
    for (int z = 0; z < CHUNK_SIZE; ++z) {
        for (int x = 0; x < CHUNK_SIZE; ++x) {
            float noiseValue = noise->GetNoise((float)(x + chunkX * CHUNK_SIZE), (float)(z + chunkZ * CHUNK_SIZE));
            int height = floor((noiseValue + 1) / 2 * CHUNK_SIZE * 4);
            int localHeight = height - chunkY * CHUNK_SIZE;
            if (localHeight < 0) localHeight = 0;
            if (localHeight >= CHUNK_SIZE)  localHeight = CHUNK_SIZE;

            for (int y = 0; y < localHeight; ++y) {
                blocks[idx(x, y, z)] = 1;
            }
        }
    }
}

void Chunk::generateMesh()
{
    mesh.clear();
    for (int z = 0; z < CHUNK_SIZE; ++z) {
        for (int y = 0; y < CHUNK_SIZE; ++y) {
            for (int x = 0; x < CHUNK_SIZE; ++x) {
                if (!solidBlockAt(x, y, z)) continue;

                if (!solidBlockAt(x-1, y, z)) addFace(x, y, z, 0);
                if (!solidBlockAt(x+1, y, z)) addFace(x, y, z, 1);
                if (!solidBlockAt(x, y-1, z)) addFace(x, y, z, 2);
                if (!solidBlockAt(x, y+1, z)) addFace(x, y, z, 3);
                if (!solidBlockAt(x, y, z-1)) addFace(x, y, z, 4);
                if (!solidBlockAt(x, y, z+1)) addFace(x, y, z, 5);
            }
        }
    }
}

bool Chunk::solidBlockAt(int x, int y, int z)
{
    if (!inChunk(x, y, z))  return false;

    int index = idx(x, y, z);
    return blocks[index] != 0;
}

void Chunk::addFace(int blockX, int blockY, int blockZ, int normalIndex)
{
    int base = normalIndex * VERTICES_PER_FACE * ITEMS_PER_VERTEX;
    for (int i = 0; i < VERTICES_PER_FACE; ++i) {
        int index = i * ITEMS_PER_VERTEX + base;
        mesh.push_back(packVertex(VOXEL_FACES[index] + blockX, VOXEL_FACES[index+1] + blockY, VOXEL_FACES[index+2] + blockZ, normalIndex));
    }
}

void Chunk::uploadMesh()
{
    glBindBuffer(GL_ARRAY_BUFFER, vbo);
    glBufferData(GL_ARRAY_BUFFER, mesh.size() * sizeof(uint32_t), mesh.data(), GL_STATIC_DRAW);
}

void Chunk::render(Shader* shader)
{
    shader->setMat4("uModel", model);

    glBindVertexArray(vao);
    glDrawArrays(GL_TRIANGLES, 0, mesh.size());
}