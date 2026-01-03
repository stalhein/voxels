CXX := g++
CXXFLAGS := -std=c++20 -Wall -Wextra -Wpedantic -MMD -MP
SRC_DIR := src
INCLUDE_DIR := include
GLAD_DIR := external/glad
BUILD_DIR := build
DEPS := $(OBJECTs:.o=.d)
TARGET := voxel_engine

SOURCES := $(shell find $(SRC_DIR) -name "*.cpp")
OBJECTS := $(patsubst $(SRC_DIR)/%.cpp,$(BUILD_DIR)/%.o,$(SOURCES))

GLAD_SRC := $(GLAD_DIR)/src/glad.c
GLAD_OBJ := $(BUILD_DIR)/glad.o
GLAD_INC := -I$(GLAD_DIR)/include

PKG_CFLAGS := $(shell pkg-config --cflags glfw3)
PKG_LIBS := $(shell pkg-config --libs glfw3) -lGL

INCLUDES := -I$(INCLUDE_DIR) $(GLAD_INC) $(PKG_CFLAGS)

-include $(DEPS)

all: $(TARGET)

$(TARGET): $(OBJECTS) $(GLAD_OBJ)
	$(CXX) $(OBJECTS) $(GLAD_OBJ) -o $@ $(PKG_LIBS) $(LDFLAGS)

$(BUILD_DIR)/%.o: $(SRC_DIR)/%.cpp
	@mkdir -p $(dir $@)
	$(CXX) $(CXXFLAGS) $(INCLUDES) -c $< -o $@

$(GLAD_OBJ): $(GLAD_SRC)
	@mkdir -p $(dir $@)
	$(CXX) $(CXXFLAGS) -I$(GLAD_DIR)/include -c $< -o $@

clean:
	rm -rf $(BUILD_DIR) $(TARGET)

run: $(TARGET)
	./$(TARGET)

.PHONY: all clean run