#pragma once

#include <GLFW/glfw3.h>
#include <glad/glad.h>
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

#include "input.hpp"
#include "shader.hpp"

class Player {
public:
  glm::vec3 position, front, frontXY, up, right, worldUp;
  float yaw, pitch, speed, sensitivity;

  Player(glm::vec3 pos);

  void update(float xoffset, float yoffset, float deltaTime);

  glm::mat4 getViewMatrix();

private:
  void updateVectors();
};