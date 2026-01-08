#pragma once

#include <GLFW/glfw3.h>
#include <glm/glm.hpp>

#include <unordered_map>

class Input {
public:
  static Input &get() {
    static Input instance;
    return instance;
  }

  void init(GLFWwindow *w) {
    window = w;

    glfwSetCursorPosCallback(window, mouse_callback);
    glfwGetCursorPos(window, &lastX, &lastY);

    currMouseState[GLFW_MOUSE_BUTTON_1] = false;
    currMouseState[GLFW_MOUSE_BUTTON_2] = false;

    prevMouseState[GLFW_MOUSE_BUTTON_1] = false;
    prevMouseState[GLFW_MOUSE_BUTTON_2] = false;
  }

  void update() {
    xOffset = tempXOffset;
    yOffset = tempYOffset;
    tempXOffset = 0.0f;
    tempYOffset = 0.0f;

    for (auto &[button, state] : currMouseState) {
      prevMouseState[button] = state;
      currMouseState[button] =
          (glfwGetMouseButton(window, button) == GLFW_PRESS);
    }
  }

  bool key(int key) { return glfwGetKey(window, key) == GLFW_PRESS; }

  bool mouseDown(int button) { return currMouseState[button]; }

  bool mousePressed(int button) {
    return currMouseState[button] && !prevMouseState[button];
  }

  bool mouseReleased(int button) {
    return !currMouseState[button] && prevMouseState[button];
  }

  float getXOffset() const { return xOffset; }
  float getYOffset() const { return yOffset; }

  Input(const Input &) = delete;
  void operator=(const Input &) = delete;

private:
  Input() = default;

  GLFWwindow *window = nullptr;

  inline static bool firstMouse = true;
  inline static double lastX = 0.0, lastY = 0.0;
  inline static float tempXOffset = 0.0f, tempYOffset = 0.0f;
  inline static float xOffset = 0.0f, yOffset = 0.0f;

  std::unordered_map<int, bool> prevMouseState;
  std::unordered_map<int, bool> currMouseState;

  static void mouse_callback(GLFWwindow *, double xpos, double ypos) {
    if (firstMouse) {
      lastX = xpos;
      lastY = ypos;
      firstMouse = false;
    }

    tempXOffset += static_cast<float>(xpos - lastX);
    tempYOffset += static_cast<float>(lastY - ypos);

    lastX = xpos;
    lastY = ypos;
  }
};