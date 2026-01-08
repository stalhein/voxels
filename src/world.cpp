#include "world.hpp"

World::World() : oldPlayerChunk(glm::ivec3(1000000000000, 10, 1000000847)) {
  noise.SetNoiseType(FastNoiseLite::NoiseType_OpenSimplex2);
  noise.SetFrequency(0.0025);
  noise.SetFractalType(FastNoiseLite::FractalType_FBm);
  noise.SetFractalOctaves(6);

  for (int x = 0; x < 24; ++x) {
    for (int y = 0; y < 10; ++y) {
      for (int z = 0; z < 24; ++z) {
        auto chunk = std::make_shared<Chunk>(this, x, y, z);
        chunk->generateTerrain(&noise);
        chunk->initOpenGL();
        chunk->state = ChunkState::NeedsMeshing;

        chunks[{x, y, z}] = chunk;
      }
    }
  }
}

void World::update(glm::vec3 playerPosition, glm::vec3 playerDirection) {
  for (auto &[coord, chunk] : chunks) {
    if (chunk->state == ChunkState::NeedsMeshing) {
      int cx = chunk->chunkX;
      int cy = chunk->chunkY;
      int cz = chunk->chunkZ;
      ChunkNeighbors n;
      n.nx = getSharedChunkAt(cx - 1, cy, cz);
      n.px = getSharedChunkAt(cx + 1, cy, cz);
      n.ny = getSharedChunkAt(cx, cy - 1, cz);
      n.py = getSharedChunkAt(cx, cy + 1, cz);
      n.nz = getSharedChunkAt(cx, cy, cz - 1);
      n.pz = getSharedChunkAt(cx, cy, cz + 1);
      chunk->generateMesh(n);
      chunk->state = ChunkState::NeedsUploading;
    }
    if (chunk->state == ChunkState::NeedsUploading) {
      chunk->uploadMesh();
      chunk->state = ChunkState::Clean;
    }
  }

  // Raycasting for block breaking/placing
  currentHit = raycast(playerPosition, playerDirection);

  auto &input = Input::get();
  double now = glfwGetTime();

  // Break
  bool breakPressed = input.mousePressed(GLFW_MOUSE_BUTTON_1);
  bool breakHeld = input.mouseDown(GLFW_MOUSE_BUTTON_1);
  if (breakPressed || (breakHeld && now - lastBreakTime > breakCooldown)) {
    lastBreakTime = now;

    glm::ivec3 chunkPos = glm::ivec3(currentHit.block / CHUNK_SIZE);
    glm::ivec3 localPos = glm::ivec3(currentHit.block - chunkPos * CHUNK_SIZE);
    auto chunk = getSharedChunkAt(chunkPos.x, chunkPos.y, chunkPos.z);

    if (chunk) {
      chunk->setBlockAt(localPos.x, localPos.y, localPos.z, BlockID::AIR);
      chunk->state = ChunkState::NeedsMeshing;

      if (localPos.x == 0) {
        auto adjacentChunk =
            getSharedChunkAt(chunkPos.x - 1, chunkPos.y, chunkPos.z);
        adjacentChunk->state = ChunkState::NeedsMeshing;
        if (localPos.x == CHUNK_SIZE - 1) {
          auto adjacentChunk =
              getSharedChunkAt(chunkPos.x + 1, chunkPos.y, chunkPos.z);
          adjacentChunk->state = ChunkState::NeedsMeshing;
        }
        if (localPos.y == 0) {
          auto adjacentChunk =
              getSharedChunkAt(chunkPos.x, chunkPos.y - 1, chunkPos.z);
          adjacentChunk->state = ChunkState::NeedsMeshing;
        }
        if (localPos.y == CHUNK_SIZE - 1) {
          auto adjacentChunk =
              getSharedChunkAt(chunkPos.x, chunkPos.y + 1, chunkPos.z);
          adjacentChunk->state = ChunkState::NeedsMeshing;
        }
        if (localPos.z == 0) {
          auto adjacentChunk =
              getSharedChunkAt(chunkPos.x, chunkPos.y, chunkPos.z - 1);
          adjacentChunk->state = ChunkState::NeedsMeshing;
        }
        if (localPos.z == CHUNK_SIZE - 1) {
          auto adjacentChunk =
              getSharedChunkAt(chunkPos.x, chunkPos.y, chunkPos.z + 1);
          adjacentChunk->state = ChunkState::NeedsMeshing;
        }
      }
    }

    // Place

    bool placePressed = input.mousePressed(GLFW_MOUSE_BUTTON_2);
    bool placeHeld = input.mouseDown(GLFW_MOUSE_BUTTON_2);
    if (placePressed || (placeHeld && now - lastPlaceTime > placeCooldown)) {
      lastPlaceTime = now;

      glm::ivec3 block = currentHit.block + currentHit.normal;
      glm::ivec3 chunkPos = glm::ivec3(block / CHUNK_SIZE);
      glm::ivec3 localPos = glm::ivec3(block - chunkPos * CHUNK_SIZE);
      auto chunk = getSharedChunkAt(chunkPos.x, chunkPos.y, chunkPos.z);

      chunk->setBlockAt(localPos.x, localPos.y, localPos.z, BlockID::GRASS);
      chunk->state = ChunkState::NeedsMeshing;
    }
  }
}

Hit World::raycast(glm::vec3 origin, glm::vec3 direction) {
  glm::vec3 dir = glm::normalize(direction);

  Hit hit;
  hit.hit = false;

  const float maxDistance = 15.0f;

  glm::ivec3 block = glm::floor(origin);

  glm::ivec3 step =
      glm::ivec3(dir.x > 0 ? 1 : -1, dir.y > 0 ? 1 : -1, dir.z > 0 ? 1 : -1);

  glm::vec3 tMax, tDelta;

  auto safeInv = [](float v) -> float {
    if (v == 0.0f)
      return std::numeric_limits<float>::infinity();
    return 1.0f / v;
  };

  auto computeInitialT = [&](float ori, float d, int b) {
    if (d == 0.0f)
      return std::numeric_limits<float>::infinity();
    float nextBoundary = b + (d > 0.0f ? 1.0f : 0.0f);
    return (nextBoundary - ori) * safeInv(d);
  };

  tMax.x = computeInitialT(origin.x, dir.x, block.x);
  tMax.y = computeInitialT(origin.y, dir.y, block.y);
  tMax.z = computeInitialT(origin.z, dir.z, block.z);

  tDelta.x = std::abs(safeInv(dir.x));
  tDelta.y = std::abs(safeInv(dir.y));
  tDelta.z = std::abs(safeInv(dir.z));

  float dist = 0.0f;

  auto normalFromAxis = [&](int axis,
                            int stepDir) -> std::pair<glm::ivec3, int> {
    glm::ivec3 n = glm::ivec3(0);
    int idx = -1;
    if (axis == 0) {
      n.x = -stepDir;
      idx = (n.x == -1 ? 0 : 1);
    }
    if (axis == 1) {
      n.y = -stepDir;
      idx = (n.y == -1 ? 2 : 3);
    }
    if (axis == 2) {
      n.z = -stepDir;
      idx = (n.z == -1 ? 4 : 5);
    }
    return {n, idx};
  };

  {
    glm::ivec3 chunkPos = block / CHUNK_SIZE;
    if (block.x < 0)
      chunkPos.x--;
    if (block.y < 0)
      chunkPos.y--;
    if (block.z < 0)
      chunkPos.z--;

    Chunk *chunk = getChunkAt(chunkPos.x, chunkPos.y, chunkPos.z);
    if (chunk) {
      glm::ivec3 local = block - chunkPos * CHUNK_SIZE;

      if (inChunkBounds(local.x, local.y, local.z) &&
          chunk->solidBlockAt(local.x, local.y, local.z)) {
        int axis = 0;
        if (std::abs(dir.y) > std::abs(dir.x) &&
            std::abs(dir.y) >= std::abs(dir.z))
          axis = 1;
        if (std::abs(dir.z) > std::abs(dir.x) &&
            std::abs(dir.z) > std::abs(dir.y))
          axis = 2;
        int stepDir = (axis == 0 ? (dir.x > 0 ? 1 : -1)
                                 : (axis == 1 ? (dir.y > 0 ? 1 : -1)
                                              : (dir.z > 0 ? 1 : -1)));
        auto pr = normalFromAxis(axis, stepDir);
        hit.hit = true;
        hit.block = block;
        hit.normal = pr.first;
        hit.normalIndex = pr.second;
        return hit;
      }
    }
  }

  while (dist < maxDistance) {
    int axis = -1;

    if (tMax.x < tMax.y) {
      if (tMax.x < tMax.z)
        axis = 0;
      else
        axis = 2;
    } else {
      if (tMax.y < tMax.z)
        axis = 1;
      else
        axis = 2;
    }

    if (axis == 0) {
      block.x += step.x;
      dist = tMax.x;
      tMax.x += tDelta.x;
    } else if (axis == 1) {
      block.y += step.y;
      dist = tMax.y;
      tMax.y += tDelta.y;
    } else {
      block.z += step.z;
      dist = tMax.z;
      tMax.z += tDelta.z;
    }

    if (dist > maxDistance)
      break;

    glm::ivec3 chunkPos = block / CHUNK_SIZE;
    if (block.x < 0)
      chunkPos.x--;
    if (block.y < 0)
      chunkPos.y--;
    if (block.z < 0)
      chunkPos.z--;

    Chunk *chunk = getChunkAt(chunkPos.x, chunkPos.y, chunkPos.z);
    if (chunk) {
      glm::ivec3 local = block - chunkPos * CHUNK_SIZE;

      if (inChunkBounds(local.x, local.y, local.z) &&
          chunk->solidBlockAt(local.x, local.y, local.z)) {
        int stepDir = (axis == 0 ? step.x : (axis == 1 ? step.y : step.z));
        auto pr = normalFromAxis(axis, stepDir);

        hit.hit = true;
        hit.block = block;
        hit.normal = pr.first;
        hit.normalIndex = pr.second;
        return hit;
      }
    }
  }

  return hit;
}

void World::render(Shader *blockShader) {
  for (auto &[coord, chunk] : chunks) {
    chunk->render(blockShader);
  }
}

Chunk *World::getChunkAt(int cx, int cy, int cz) {
  ChunkCoord key{cx, cy, cz};

  auto it = chunks.find(key);
  if (it != chunks.end())
    return it->second.get();

  return nullptr;
}

std::shared_ptr<Chunk> World::getSharedChunkAt(int cx, int cy, int cz) {
  ChunkCoord key{cx, cy, cz};

  auto it = chunks.find(key);
  if (it != chunks.end())
    return it->second;

  return nullptr;
}
