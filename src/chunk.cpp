#include "chunk.hpp"
#include "world.hpp"

constexpr int VOXEL_FACES[] = {
    // Left
    0, 0, 0, 0, 1, 1, 0, 1, 0,

    0, 0, 0, 0, 0, 1, 0, 1, 1,

    // Right
    1, 0, 0, 1, 1, 0, 1, 1, 1,

    1, 0, 0, 1, 1, 1, 1, 0, 1,

    // Bottom
    0, 0, 0, 1, 0, 0, 1, 0, 1,

    0, 0, 0, 1, 0, 1, 0, 0, 1,

    // Top
    0, 1, 0, 1, 1, 1, 1, 1, 0,

    0, 1, 0, 0, 1, 1, 1, 1, 1,

    // Back
    0, 0, 0, 1, 1, 0, 1, 0, 0,

    0, 0, 0, 0, 1, 0, 1, 1, 0,

    // Front
    0, 0, 1, 1, 0, 1, 1, 1, 1,

    0, 0, 1, 1, 1, 1, 0, 1, 1};

constexpr int ITEMS_PER_VERTEX = 3;
constexpr int VERTICES_PER_FACE = 6;

Chunk::Chunk(World *w, int x, int y, int z)
    : chunkX(x), chunkY(y), chunkZ(z), world(w) {
  model = glm::translate(
      glm::mat4(1.0f),
      glm::vec3(chunkX * CHUNK_SIZE, chunkY * CHUNK_SIZE, chunkZ * CHUNK_SIZE));
}

void Chunk::generateTerrain(FastNoiseLite *noise) {
  blocks.fill(BlockID::AIR);
  for (int z = 0; z < CHUNK_SIZE; ++z) {
    for (int x = 0; x < CHUNK_SIZE; ++x) {
      float noiseValue = noise->GetNoise((float)(x + chunkX * CHUNK_SIZE),
                                         (float)(z + chunkZ * CHUNK_SIZE));
      int height = floor((noiseValue + 1) / 2 * CHUNK_SIZE * 10);
      int localHeight = height - chunkY * CHUNK_SIZE;
      if (localHeight < 0)
        localHeight = 0;
      if (localHeight >= CHUNK_SIZE)
        localHeight = CHUNK_SIZE;

      for (int y = 0; y < CHUNK_SIZE; ++y) {
        if (y < localHeight) {
          if (y + chunkY * CHUNK_SIZE < CHUNK_SIZE * 3)
            blocks[idx(x, y, z)] = BlockID::SAND;
          else if (y + chunkY * CHUNK_SIZE >= height - 1)
            blocks[idx(x, y, z)] = BlockID::GRASS;
          else
            blocks[idx(x, y, z)] = BlockID::DIRT;
        } else if (chunkY * CHUNK_SIZE + y < CHUNK_SIZE * 2.5) {
          blocks[idx(x, y, z)] = BlockID::WATER;
        }
      }
    }
  }
}

void Chunk::initOpenGL() {
  glGenBuffers(1, &blockVbo);
  glGenVertexArrays(1, &blockVao);
  glBindVertexArray(blockVao);
  glBindBuffer(GL_ARRAY_BUFFER, blockVbo);

  glVertexAttribIPointer(0, 1, GL_UNSIGNED_INT, sizeof(uint32_t), (void *)0);
  glEnableVertexAttribArray(0);
}

void Chunk::generateMesh(const ChunkNeighbors &n) {
  blockMesh.clear();
  blockMesh.reserve(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE * 6);

  for (int z = 0; z < CHUNK_SIZE; ++z) {
    for (int y = 0; y < CHUNK_SIZE; ++y) {
      for (int x = 0; x < CHUNK_SIZE; ++x) {
        BlockID block = blocks[idx(x, y, z)];
        if (block == BlockID::AIR)
          continue;
        else if (isOpaque(block))
          meshBlock(n, x, y, z);
      }
    }
  }
}

void Chunk::meshBlock(const ChunkNeighbors &n, int x, int y, int z) {
  bool visible;
  BlockID block = (BlockID)blocks[idx(x, y, z)];

  // X
  if (x > 0) {
    visible = !solidBlockAt(x - 1, y, z);
  } else {
    visible = !n.nx || !n.nx->solidBlockAt(CHUNK_SIZE - 1, y, z);
  }
  if (visible)
    addFace(x, y, z, 0, block, blockMesh);

  if (x < CHUNK_SIZE - 1) {
    visible = !solidBlockAt(x + 1, y, z);
  } else {
    visible = !n.px || !n.px->solidBlockAt(0, y, z);
  }
  if (visible)
    addFace(x, y, z, 1, block, blockMesh);

  // Y
  if (y > 0) {
    visible = !solidBlockAt(x, y - 1, z);
  } else {
    visible = !n.ny || !n.ny->solidBlockAt(x, CHUNK_SIZE - 1, z);
  }
  if (visible)
    addFace(x, y, z, 2, block, blockMesh);

  if (y < CHUNK_SIZE - 1) {
    visible = !solidBlockAt(x, y + 1, z);
  } else {
    visible = !n.py || !n.py->solidBlockAt(x, 0, z);
  }
  if (visible)
    addFace(x, y, z, 3, block, blockMesh);

  // Z
  if (z > 0) {
    visible = !solidBlockAt(x, y, z - 1);
  } else {
    visible = !n.nz || !n.nz->solidBlockAt(x, y, CHUNK_SIZE - 1);
  }
  if (visible)
    addFace(x, y, z, 4, block, blockMesh);

  if (z < CHUNK_SIZE - 1) {
    visible = !solidBlockAt(x, y, z + 1);
  } else {
    visible = !n.pz || !n.pz->solidBlockAt(x, y, 0);
  }
  if (visible)
    addFace(x, y, z, 5, block, blockMesh);
}

BlockID Chunk::getBlockAt(int x, int y, int z) {
  int index = idx(x, y, z);
  return blocks[index];
}

bool Chunk::solidBlockAt(int x, int y, int z) {
  int index = idx(x, y, z);
  return isSolid(blocks[index]);
}

void Chunk::setBlockAt(int x, int y, int z, BlockID block) {
  if (!inChunk(x, y, z))
    return;

  blocks[idx(x, y, z)] = block;
}

void Chunk::addFace(int blockX, int blockY, int blockZ, int normalIndex,
                    BlockID blockType, std::vector<uint32_t> &mesh) {
  int base = normalIndex * VERTICES_PER_FACE * ITEMS_PER_VERTEX;
  for (int i = 0; i < VERTICES_PER_FACE; ++i) {
    int index = i * ITEMS_PER_VERTEX + base;
    mesh.push_back(
        packVertex(VOXEL_FACES[index] + blockX, VOXEL_FACES[index + 1] + blockY,
                   VOXEL_FACES[index + 2] + blockZ, normalIndex, blockType));
  }
}

void Chunk::uploadMesh() {
  glBindBuffer(GL_ARRAY_BUFFER, blockVbo);
  glBufferData(GL_ARRAY_BUFFER, blockMesh.size() * sizeof(uint32_t),
               blockMesh.data(), GL_STATIC_DRAW);
}

void Chunk::render(Shader *blockShader) {
  blockShader->use();
  blockShader->setMat4("uModel", model);

  glBindVertexArray(blockVao);
  glDrawArrays(GL_TRIANGLES, 0, blockMesh.size());
}