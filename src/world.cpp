#include "world.hpp"

World::World()
{
    for (int z = 0; z < 8; ++z) {
        for (int y = 0; y < 8; ++y) {
            for (int x = 0; x < 8; ++x) {
                chunks[{x, y, z}] = std::make_unique<Chunk>(x, y, z);
                chunks[{x, y, z}]->generateTerrain();
                chunks[{x, y, z}]->generateMesh();
                chunks[{x, y, z}]->uploadMesh();
            }
        }
    }
}

void World::render(Shader* shader)
{
    for (auto& [coord, chunk] : chunks) {
        chunk->render(shader);
    }
}