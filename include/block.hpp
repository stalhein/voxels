#pragma once

enum class BlockID : uint8_t { AIR, WATER, GRASS, DIRT, SAND, COUNT };

struct BlockDef {
  const char *name;

  bool solid;
  bool opaque;
  bool visible;
};

inline const BlockDef BLOCKS[(int)BlockID::COUNT]{{"air", false, false, false},
                                                  {"water", false, false, true},
                                                  {"grass", true, true, true},
                                                  {"dirt", true, true, true},
                                                  {"sand", true, true, true}};

inline bool isSolid(BlockID b) { return BLOCKS[(int)b].solid; }

inline bool isOpaque(BlockID b) { return BLOCKS[(int)b].opaque; }

inline bool isVisible(BlockID b) { return BLOCKS[(int)b].visible; }
