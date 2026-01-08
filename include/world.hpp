#pragma once

#include <glm/glm.hpp>

#include <memory>
#include <unordered_map>

#include "block.hpp"
#include "chunk.hpp"
#include "fastnoiselite.hpp"
#include "input.hpp"
#include "settings.hpp"
#include "shader.hpp"

struct ChunkCoord {
  int x, y, z;

  bool operator==(const ChunkCoord &o) const noexcept {
    return x == o.x && y == o.y && z == o.z;
  }
};

struct ChunkCoordHash {
  size_t operator()(const ChunkCoord &c) const noexcept {
    uint64_t h = 0;
    h ^= std::hash<int>()(c.x) + 0x9e3779b97f4a7c15ULL + (h << 6) + (h >> 2);
    h ^= std::hash<int>()(c.y) + 0x9e3779b97f4a7c15ULL + (h << 6) + (h >> 2);
    h ^= std::hash<int>()(c.z) + 0x9e3779b97f4a7c15ULL + (h << 6) + (h >> 2);
    return h;
  }
};

struct Hit {
  bool hit;
  glm::ivec3 block;
  glm::ivec3 normal;
  int normalIndex;
};

class World {
public:
  World();

  void update(glm::vec3 playerPosition, glm::vec3 playerDirection);
  void render(Shader *blockShader);

  Chunk *getChunkAt(int cx, int cy, int cz);
  std::shared_ptr<Chunk> getSharedChunkAt(int cx, int cy, int cz);

private:
  FastNoiseLite noise;

  std::unordered_map<ChunkCoord, std::shared_ptr<Chunk>, ChunkCoordHash> chunks;
  
  glm::ivec3 oldPlayerChunk;
  Hit currentHit;
  double lastBreakTime;
  double lastPlaceTime;
  const double breakCooldown = 0.2;
  const double placeCooldown = 0.2;
  uint8_t currentBlock;

  Hit raycast(glm::vec3 origin, glm::vec3 direction);
  inline bool inChunkBounds(int x, int y, int z) noexcept {
    return (unsigned)x < CHUNK_SIZE && (unsigned)y < CHUNK_SIZE &&
           (unsigned)z < CHUNK_SIZE;
  }
};