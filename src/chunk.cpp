#include "chunk.hpp"

Chunk::Chunk()
{
    mesh.push_back(packVertex(0, 0, 0));
    mesh.push_back(packVertex(0, 10, 0));
    mesh.push_back(packVertex(10, 10, 0));

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