#pragma once

#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <glm/glm.hpp>

#include <array>
#include <vector>
#include <iostream>

#include "settings.hpp"
#include "shader.hpp"

constexpr int CHUNK_SIZE = 16;
constexpr int BLOCKS_IN_CHUNK = CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE;

class Chunk
{
public:
    int chunkX, chunkY, chunkZ;

    Chunk(int x, int y, int z);

    void generateTerrain();
    void generateMesh();
    void uploadMesh();

    void render(Shader* shader);

private:
    glm::mat4 model;

    std::array<uint8_t, BLOCKS_IN_CHUNK> blocks;
    std::vector<uint32_t> mesh;

    GLuint vbo, vao;

    bool solidBlockAt(int x, int y, int z);

    void addFace(int blockX, int blockY, int blockZ, int normalIndex);

    inline int idx(int x, int y, int z) { return z * CHUNK_SIZE * CHUNK_SIZE + y * CHUNK_SIZE + x; }
    inline uint32_t packVertex(int x, int y, int z, int normalIndex)
    {
        return (uint32_t)((x & 31) | ((y & 31) << 5) | ((z & 31) << 10) | ((normalIndex & 7) << 15));
    }
    inline bool inChunk(int x, int y, int z)
    {
        return x >= 0 && y >= 0 && z >= 0 && x < CHUNK_SIZE && y < CHUNK_SIZE && z < CHUNK_SIZE;
    }
};