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
    1, 1, 1,
    1, 1, 0,

    1, 0, 0,
    1, 0, 1,
    1, 1, 1
};

constexpr int ITEMS_PER_VERTEX = 3;
constexpr int VERTICES_PER_FACE = 6;

Chunk::Chunk()
{
    for (int i = 0; i < VERTICES_PER_FACE * 2; ++i) {
        int base = i * ITEMS_PER_VERTEX;
        mesh.push_back(packVertex(VOXEL_FACES[base], VOXEL_FACES[base+1], VOXEL_FACES[base+2]));
    }

    glGenBuffers(1, &vbo);
    glGenVertexArrays(1, &vao);
    glBindVertexArray(vao);
    glBindBuffer(GL_ARRAY_BUFFER, vbo);

    glVertexAttribIPointer(0, 1, GL_UNSIGNED_INT, sizeof(uint32_t), (void*)0);
    glEnableVertexAttribArray(0);

    uploadMesh();
}

void Chunk::generateTerrain()
{

}

void Chunk::generateMesh()
{

}

void Chunk::uploadMesh()
{
    glBindBuffer(GL_ARRAY_BUFFER, vbo);
    glBufferData(GL_ARRAY_BUFFER, mesh.size() * sizeof(uint32_t), mesh.data(), GL_STATIC_DRAW);
}

void Chunk::render(Shader* shader)
{
    shader->setMat4("uModel", glm::mat4(1.0f));

    glBindVertexArray(vao);
    glDrawArrays(GL_TRIANGLES, 0, mesh.size());
}