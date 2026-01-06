#include "world.hpp"

World::World() : pool(std::max(1u, std::thread::hardware_concurrency() - 1)), oldPlayerChunk(glm::ivec3(1000000000000, 10, 1000000847))
{
    noise.SetNoiseType(FastNoiseLite::NoiseType_OpenSimplex2);
    noise.SetFrequency(0.0067);
    noise.SetFractalType(FastNoiseLite::FractalType_FBm);
    noise.SetFractalOctaves(4);

    for (int x = 0; x < 24; ++x) {
        for (int y = 0; y < 10; ++y) {
            for (int z = 0; z < 24; ++z) {
                auto chunk = std::make_shared<Chunk>(this, x, y, z);
                chunk->generateTerrain(&noise);
                chunk->state = ChunkState::NeedsMeshing;

                chunks[{x, y, z}] = chunk;
                meshQueue.push_back(chunk);
            }
        }
    }
}

void World::update(glm::vec3 playerPosition)
{
    glm::ivec3 playerChunk = glm::floor(playerPosition / (float)CHUNK_SIZE);

    const int MAX_MESH_JOBS = 6;

    // Chunk meshing
    int jobs = 0;
    while (!meshQueue.empty() && (jobs < MAX_MESH_JOBS || meshQueue.size() > 1000)) {
        auto chunk = meshQueue.front();
        meshQueue.pop_front();

        ChunkState expected = ChunkState::NeedsMeshing;
        if (!chunk->state.compare_exchange_strong(expected, ChunkState::Meshing))   continue;

        int cx = chunk->chunkX;
        int cy = chunk->chunkY;
        int cz = chunk->chunkZ;
        
        ChunkNeighbors n;
        n.nx = getSharedChunkAt(cx-1, cy, cz);
        n.px = getSharedChunkAt(cx+1, cy, cz);
        n.ny = getSharedChunkAt(cx, cy-1, cz);
        n.py = getSharedChunkAt(cx, cy+1, cz);
        n.nz = getSharedChunkAt(cx, cy, cz-1);
        n.pz = getSharedChunkAt(cx, cy, cz+1);

        (void)pool.submit_task([chunk, n]() {
            chunk->generateMesh(n);
            chunk->state.store(ChunkState::NeedsUploading, std::memory_order_release);
        });

        jobs++;
    }

    
    // Chunk upload mesh
    int uploads = 0;
    for (auto& [coord, chunk] : chunks) {
        if (chunk->state == ChunkState::NeedsUploading) {
            chunk->uploadMesh();
            chunk->state = ChunkState::Clean;
            uploads++;
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
