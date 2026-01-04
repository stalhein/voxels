#pragma once

#include <glad/glad.h>
#include <GLFW/glfw3.h>

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
    Chunk();

    void generateTerrain();
    void generateMesh();
    void uploadMesh();

    void render(Shader* shader);

private:
    std::array<uint8_t, BLOCKS_IN_CHUNK> blocks;
    std::vector<uint32_t> mesh;

    GLuint vbo, vao;

    inline int idx(int x, int y, int z) { return z * CHUNK_SIZE * CHUNK_SIZE + y * CHUNK_SIZE + x; }
    inline uint32_t packVertex(int x, int y, int z)
    {
        return (uint32_t)((x & 31) | ((y & 31) << 5) | ((z & 31) << 10));
    }
};