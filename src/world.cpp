#include "world.hpp"

World::World()
{
    noise.SetNoiseType(FastNoiseLite::NoiseType_OpenSimplex2);
    noise.SetFrequency(0.0067);
    noise.SetFractalType(FastNoiseLite::FractalType_FBm);
    noise.SetFractalOctaves(4);

    for (int z = 0; z < 8; ++z) {
        for (int y = 0; y < 8; ++y) {
            for (int x = 0; x < 8; ++x) {
                chunks[{x, y, z}] = std::make_unique<Chunk>(x, y, z);
                chunks[{x, y, z}]->generateTerrain(&noise);
                chunks[{x, y, z}]->dirty = true;
            }
        }
    }
}

void World::update()
{
    for (auto& [coord, chunk] : chunks) {
        if (chunk->dirty) {
            chunk->generateMesh();
            chunk->uploadMesh();
            chunk->dirty = false;
        }
    }
}

void World::render(Shader* shader)
{
    for (auto& [coord, chunk] : chunks) {
        chunk->render(shader);
    }
}