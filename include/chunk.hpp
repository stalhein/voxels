#pragma once

#include <GLFW/glfw3.h>
#include <glad/glad.h>

#include <glm/glm.hpp>

#include <array>
#include <atomic>
#include <iostream>
#include <memory>
#include <vector>

#include "block.hpp"
#include "fastnoiselite.hpp"
#include "settings.hpp"
#include "shader.hpp"

constexpr int CHUNK_SIZE = 16;
constexpr int BLOCKS_IN_CHUNK = CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE;

enum class ChunkState { Clean, NeedsMeshing, NeedsUploading };

class World;
class Chunk;

struct ChunkNeighbors {
  std::shared_ptr<Chunk> nx, px, ny, py, nz, pz;
};

class Chunk {
public:
  int chunkX, chunkY, chunkZ;

  std::atomic<ChunkState> state{ChunkState::Clean};

  Chunk(World *w, int x, int y, int z);

  void generateTerrain(FastNoiseLite *noise);
  void initOpenGL();
  void generateMesh(const ChunkNeighbors &n);
  void uploadMesh();

  void render(Shader *blockShader);

  inline BlockID getBlockAt(int x, int y, int z);
  inline bool solidBlockAt(int x, int y, int z);

  void setBlockAt(int x, int y, int z, BlockID block);

private:
  World *world;

  glm::mat4 model;

  std::array<BlockID, BLOCKS_IN_CHUNK> blocks;
  std::vector<uint32_t> blockMesh;

  GLuint blockVbo, blockVao;

  void meshBlock(const ChunkNeighbors &n, int x, int y, int z);

  void addFace(int blockX, int blockY, int blockZ, int normalIndex,
               BlockID blockType, std::vector<uint32_t> &mesh);

  inline int idx(int x, int y, int z) {
    return z * CHUNK_SIZE * CHUNK_SIZE + y * CHUNK_SIZE + x;
  }
  inline uint32_t packVertex(int x, int y, int z, int normalIndex,
                             BlockID blockType) {
    return (uint32_t)((x & 31) | ((y & 31) << 5) | ((z & 31) << 10) |
                      ((normalIndex & 7) << 15) |
                      (((int)blockType & 255) << 18));
  }
  inline bool inChunk(int x, int y, int z) {
    return x >= 0 && y >= 0 && z >= 0 && x < CHUNK_SIZE && y < CHUNK_SIZE &&
           z < CHUNK_SIZE;
  }
};