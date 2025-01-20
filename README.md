ChatApp

A real-time chat application with user registration, login, and message delivery functionality built using Node.js, MongoDB, and Socket.io. This application supports user authentication, JWT-based sessions, and real-time communication between users.

Deployed Application:
https://sparrow-seven.vercel.app/

Features

    User Registration and Authentication: Users can register with their phone number and username, and authenticate using JWT tokens.
    Real-time Messaging: Uses Socket.io to provide real-time message delivery between users.
    Message Persistence: Messages are stored in a MongoDB database and can be retrieved even if the user is offline.
    Logout and Session Management: Secure logout mechanism that terminates user sessions and disconnections from Socket.io.


![SignUpPage](https://github.com/user-attachments/assets/e5d67a48-abcc-4fd1-837b-74d5695c84d8)
![LoginPage](https://github.com/user-attachments/assets/a960f434-013f-44dc-b7f7-ede4d62cd7b1)
![ChatPage2](https://github.com/user-attachments/assets/5cab943b-28f7-4c06-a199-7fa3a9439123)
![ChatPage1](https://github.com/user-attachments/assets/16900f32-cb21-47f6-9ade-b99cbb289660)


Tech Stack
    Backend: Node.js, Express.js
    Database: MongoDB (with Mongoose)
    Authentication: JSON Web Tokens (JWT), bcryptjs
    Real-time Communication: Socket.io
    Environment Variables: dotenv

Installation
  Prerequisites

    Node.js (v14 or higher)
    MongoDB instance (You can use a local MongoDB server or MongoDB Atlas for cloud hosting)
    .env file for secret keys and database URI

Steps

Clone the repository:

      git clone https://github.com/your-username/chatapp.git
      cd chatapp

Install dependencies:

    npm install

Create a .env file at the root of the project and add your MongoDB URI and JWT secret key:

  JWT_SECRET=your_jwt_secret_key
  MONGO_URI=your_mongo_connection_string

Start the application:

    npm start

The application will be running on http://localhost:5000.

API Endpoints
1. POST /register

    Register a new user.
    Request Body:

{
  "phoneNumber": "user_phone_number",
  "username": "user_name",
  "password": "user_password"
}

Response:

    {
      "token": "JWT_token",
      "profileId": "user_profile_id",
      "username": "user_name",
      "message": "Registration successful"
    }

2. POST /login

    User login with phone number and password.
    Request Body:

{
  "phoneNumber": "user_phone_number",
  "password": "user_password"
}

Response:

    {
      "token": "JWT_token",
      "profileId": "user_profile_id",
      "username": "user_name",
      "message": "Login successful"
    }

3. POST /logout

    User logout and disconnect from Socket.io.
    Request Body:

{
  "profileId": "user_profile_id"
}

Response:

    {
      "message": "Logout successful and connection terminated"
    }

Real-time Messaging

    Once logged in, users can send and receive messages in real-time.
    Messages are stored in the MongoDB database and can be delivered when the recipient comes online.
    Offline users will receive undelivered messages once they log in again.

.env Configuration

You need to create a .env file in the root of the project to store sensitive configuration like JWT secret and MongoDB URI.
Example .env file:

JWT_SECRET=your_jwt_secret_key
MONGO_URI=your_mongo_connection_string
