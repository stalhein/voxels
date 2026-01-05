#include "world.hpp"

World::World() : pool(std::max(1u, std::thread::hardware_concurrency() - 1)), oldPlayerChunk(glm::ivec3(1000000000000, 10, 1000000847))
{
    noise.SetNoiseType(FastNoiseLite::NoiseType_OpenSimplex2);
    noise.SetFrequency(0.0067);
    noise.SetFractalType(FastNoiseLite::FractalType_FBm);
    noise.SetFractalOctaves(4);
}

void World::update(glm::vec3 playerPosition)
{
    glm::ivec3 playerChunk = glm::floor(playerPosition / (float)CHUNK_SIZE);

    const int RENDER_DISTANCE = 16;
    const int RENDER_DISTANCE_SQUARED = RENDER_DISTANCE * RENDER_DISTANCE;
    const int MAX_MESH_JOBS = 6;

    // Chunk creation
    if (playerChunk.x != oldPlayerChunk.x || playerChunk.z != oldPlayerChunk.z) {
        double oldTime = glfwGetTime();
        for (int x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; ++x) {
            for (int z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; ++z) {
                if (x*x + z*z > RENDER_DISTANCE_SQUARED)    continue;

                for (int y = 0; y < 8; ++y) {
                    int cx = playerChunk.x + x;
                    int cz = playerChunk.z + z;

                    if (getChunkAt(cx, y, cz))  continue;

                    auto chunk = std::make_shared<Chunk>(this, cx, y, cz);
                    chunk->generateTerrain(&noise);
                    chunk->state = ChunkState::NeedsMeshing;

                    chunks[{cx, y, cz}] = chunk;
                    meshQueue.push_back(chunk);
                }
            }
        }
        oldPlayerChunk = playerChunk;
        std::cout << glfwGetTime() - oldTime << std::endl;
    }

    // Chunk meshing
    int jobs = 0;
    while (!meshQueue.empty() && (jobs < MAX_MESH_JOBS || meshQueue.size() > 500)) {
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
