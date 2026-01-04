#include "player.hpp"

Player::Player(glm::vec3 pos) :
    position(pos), front(glm::vec3(0.0f, 0.0f, -1.0f)),
    frontXY(glm::vec3(0.0f, 0.0f, -1.0f)),
    up(glm::vec3(0.0f, 1.0f, 0.0f)),
    worldUp(glm::vec3(0.0f, 1.0f, 0.0f)), yaw(-90.0f),
    pitch(0.0f), speed(20.0f), sensitivity(0.1f)
{
    updateVectors();
}

void Player::update(float xoffset, float yoffset, float deltaTime) {
    auto& input = Input::get();
    if (input.key(GLFW_KEY_W)) { position += frontXY * (deltaTime * speed); }
    if (input.key(GLFW_KEY_S)) { position -= frontXY * (deltaTime * speed); }
    if (input.key(GLFW_KEY_D)) { position += right * (deltaTime * speed); }
    if (input.key(GLFW_KEY_A)) { position -= right * (deltaTime * speed); }
    if (input.key(GLFW_KEY_SPACE)) { position += worldUp * (deltaTime * speed); }
    if (input.key(GLFW_KEY_LEFT_SHIFT)) { position -= worldUp * (deltaTime * speed); }

    xoffset *= sensitivity;
    yoffset *= sensitivity;
    
    yaw += xoffset;
    pitch += yoffset;

    if (pitch > 89.0f)  { pitch = 89.9f; }
    if (pitch < -89.0f) { pitch = -89.9f; }

    xoffset = 0.0f;
    yoffset = 0.0f;

    updateVectors();
}

glm::mat4 Player::getViewMatrix()
{
    return glm::lookAt(position, position + front, up);
}

void Player::updateVectors()
{
    glm::vec3 f;
    f.x = cos(glm::radians(yaw)) * cos(glm::radians(pitch));
    f.y = 0.0f;
    f.z = sin(glm::radians(yaw)) * cos(glm::radians(pitch));
    frontXY = glm::normalize(f);
    f.y = sin(glm::radians(pitch));
    front = glm::normalize(f);

    right = glm::normalize(glm::cross(front, worldUp));
    up = glm::normalize(glm::cross(right, front));
}