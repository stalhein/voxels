#include "world.hpp"

World::World() : pool(std::max(1u, std::thread::hardware_concurrency() - 1)), oldPlayerChunkPosition(glm::ivec3(1000000000000, 10, 1000000847))
{
    noise.SetNoiseType(FastNoiseLite::NoiseType_OpenSimplex2);
    noise.SetFrequency(0.0067);
    noise.SetFractalType(FastNoiseLite::FractalType_FBm);
    noise.SetFractalOctaves(4);
}

void World::update(glm::vec3 playerPosition)
{
    glm::ivec3 playerChunkPosition = glm::floor(playerPosition / (float)CHUNK_SIZE);

    const int RENDER_DISTANCE = 16;

    if (playerChunkPosition.x != oldPlayerChunkPosition.x || playerChunkPosition.z != oldPlayerChunkPosition.z) {
        for (int x = playerChunkPosition.x - RENDER_DISTANCE; x < playerChunkPosition.x + RENDER_DISTANCE; ++x) {
            for (int y = 0; y < 8; ++y) {
                for (int z = playerChunkPosition.z - RENDER_DISTANCE; z < playerChunkPosition.z + RENDER_DISTANCE; ++z) {
                    if (glm::length(glm::vec3(x, 0, z) - glm::vec3(playerChunkPosition.x, 0, playerChunkPosition.z)) > RENDER_DISTANCE)   continue;
                    Chunk* chunk = getChunkAt(x, y, z);
                    if (chunk == nullptr) {
                        chunks[{x, y, z}] = std::make_shared<Chunk>(this, x, y, z);
                        chunks[{x, y, z}]->generateTerrain(&noise);
                        chunks[{x, y, z}]->state = ChunkState::NeedsMeshing;
                    }
                }
            }
        }

        oldPlayerChunkPosition = playerChunkPosition;
    }

    int currentJobs = 0;

    for (auto& [coord, chunk] : chunks) {
        if (currentJobs > 20)    break;
        ChunkState expected = ChunkState::NeedsMeshing;

        if (chunk->state.compare_exchange_strong(expected, ChunkState::Meshing)) {
            std::shared_ptr<Chunk> chunkPtr = chunk;

            int cx = chunkPtr->chunkX;
            int cy = chunkPtr->chunkY;
            int cz = chunkPtr->chunkZ;

            ChunkNeighbors neighbors;
            neighbors.nx = getSharedChunkAt(cx - 1, cy, cz);
            neighbors.px = getSharedChunkAt(cx + 1, cy, cz);
            neighbors.ny = getSharedChunkAt(cx, cy - 1, cz);
            neighbors.py = getSharedChunkAt(cx, cy + 1, cz);
            neighbors.nz = getSharedChunkAt(cx, cy, cz - 1);
            neighbors.pz = getSharedChunkAt(cx, cy, cz + 1);

            pool.submit_task([chunkPtr, neighbors]()
            {
                chunkPtr->generateMesh(neighbors);
                chunkPtr->state.store(
                    ChunkState::NeedsUploading,
                    std::memory_order_release
                );
            });
            currentJobs++;
        }
    }

    
    for (auto& [coord, chunk] : chunks) {
        if (chunk->state == ChunkState::NeedsUploading) {
            chunk->uploadMesh();
            chunk->state = ChunkState::Clean;
        }
    }
}

void World::render(Shader* shader)
{
    for (auto& [coord, chunk] : chunks) {
        chunk->render(shader);
    }
}

Chunk* World::getChunkAt(int cx, int cy, int cz)
{
    ChunkCoord key{cx, cy, cz};

    auto it = chunks.find(key);
    if (it != chunks.end()) return it->second.get();

    return nullptr;
}

std::shared_ptr<Chunk> World::getSharedChunkAt(int cx, int cy, int cz)
{
    ChunkCoord key{cx, cy, cz};

    auto it = chunks.find(key);
    if (it != chunks.end()) return it->second;

    return nullptr;
}
