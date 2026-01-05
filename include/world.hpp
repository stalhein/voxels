#pragma once

#include <glm/glm.hpp>

#include <unordered_map>
#include <memory>

#include "settings.hpp"
#include "shader.hpp"
#include "chunk.hpp"
#include "fastnoiselite.hpp"
#include "BS_thread_pool.hpp"

struct ChunkCoord
{
    int x, y, z;

    bool operator==(const ChunkCoord& o) const noexcept
    {
        return x == o.x && y == o.y && z == o.z;
    }
};

struct ChunkCoordHash
{
    size_t operator()(const ChunkCoord& c) const noexcept
    {
        uint64_t h = 0;
        h ^= std::hash<int>()(c.x) + 0x9e3779b97f4a7c15ULL + (h<<6) + (h>>2);
        h ^= std::hash<int>()(c.y) + 0x9e3779b97f4a7c15ULL + (h<<6) + (h>>2);
        h ^= std::hash<int>()(c.z) + 0x9e3779b97f4a7c15ULL + (h<<6) + (h>>2);
        return h;
    }
};

class World
{
public:
    World();

    void update(glm::vec3 playerPosition);
    void render(Shader* shader);

    Chunk* getChunkAt(int cx, int cy, int cz);
    std::shared_ptr<Chunk> getSharedChunkAt(int cx, int cy, int cz);
private:
    BS::thread_pool<> pool;
    glm::ivec3 oldPlayerChunkPosition;

    FastNoiseLite noise;

    std::unordered_map<ChunkCoord, std::shared_ptr<Chunk>, ChunkCoordHash> chunks;
};