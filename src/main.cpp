#include <GLFW/glfw3.h>
#include <glad/glad.h>

#include <iostream>

#include "input.hpp"
#include "player.hpp"
#include "settings.hpp"
#include "shader.hpp"
#include "world.hpp"

void framebuffer_size_callback(GLFWwindow *window, int width, int height);

float deltaTime = 0.0f;
float lastFrame = 0.0f;

int main() {
  glfwInit();
  glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
  glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 4);
  glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
  GLFWwindow *window =
      glfwCreateWindow(SCREEN_WIDTH, SCREEN_HEIGHT, "Voxels", NULL, NULL);
  if (window == NULL) {
    std::cerr << "Failed to create GLFW window." << std::endl;
    glfwTerminate();
    return -1;
  }
  glfwMakeContextCurrent(window);
  glfwSwapInterval(1);

  if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) {
    std::cerr << "Failed to initialize GLAD." << std::endl;
    return -1;
  }
  glViewport(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);
  glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);

  int fbw, fbh;
  glfwGetFramebufferSize(window, &fbw, &fbh);
  framebuffer_size_callback(window, fbw, fbh);

  glEnable(GL_DEPTH_TEST);
  glEnable(GL_CULL_FACE);
  glEnable(GL_BLEND);
  glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

  // glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);

  Input::get().init(window);
  Shader blockShader("shaders/block_vertex.glsl",
                     "shaders/block_fragment.glsl");
  Player player({0.0f, 0.0f, 0.0f});
  World world;

  while (!glfwWindowShouldClose(window)) {
    float time = glfwGetTime();
    deltaTime = time - lastFrame;
    lastFrame = time;

    // std::cout << 1 / deltaTime << "\n";

    Input::get().update();
    auto &input = Input::get();
    if (input.key(GLFW_KEY_ESCAPE)) {
      glfwSetWindowShouldClose(window, 1);
    }

    player.update(input.getXOffset(), input.getYOffset(), deltaTime);

    world.update(player.position, player.front);

    glClearColor(0.1f, 0.3f, 0.4f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    glm::mat4 projection = glm::perspective(
        glm::radians(50.0f), (float)SCREEN_WIDTH / (float)SCREEN_HEIGHT, 0.1f,
        1000.0f);
    glm::mat4 view = player.getViewMatrix();

    blockShader.use();
    blockShader.setVec3("uPlayerPosition", player.position);
    blockShader.setMat4("uProjection", projection);
    blockShader.setMat4("uView", view);

    world.render(&blockShader);

    glfwSwapBuffers(window);
    glfwPollEvents();
  }

  glfwTerminate();
  return 0;
}

void framebuffer_size_callback(GLFWwindow *, int width, int height) {
  glViewport(0, 0, width, height);
  screenWidth = width;
  screenHeight = height;
}