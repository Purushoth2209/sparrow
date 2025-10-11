# ChatApp

A real-time chat application with user registration, login, and message delivery functionality built using Node.js, MongoDB, and Socket.io. This application supports user authentication, JWT-based sessions, and real-time communication between users.

## Features

- **User Registration and Authentication**: Users can register with their phone number and username, and authenticate using JWT tokens.
- **Real-time Messaging**: Uses Socket.io to provide real-time message delivery between users.
- **Message Persistence**: Messages are stored in a MongoDB database and can be retrieved even if the user is offline.
- **Logout and Session Management**: Secure logout mechanism that terminates user sessions and disconnections from Socket.io.

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB (with Mongoose)
- **Authentication**: JSON Web Tokens (JWT), bcryptjs
- **Real-time Communication**: Socket.io
- **Environment Variables**: dotenv

## Installation

### Prerequisites

- Node.js (v14 or higher)
- MongoDB instance (You can use a local MongoDB server or MongoDB Atlas for cloud hosting)
- `.env` file for secret keys and database URI

### Steps

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/chatapp.git
   cd chatapp
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file at the root of the project and add your MongoDB URI and JWT secret key:

   ```
   JWT_SECRET=your_jwt_secret_key
   MONGO_URI=your_mongo_connection_string
   ```

4. Start the application:

   ```bash
   npm start
   ```

   The application will be running on `http://localhost:5000`.

## API Endpoints

### 1. **POST** `/register`

- Register a new user.
- **Request Body**:
  ```json
  {
    "phoneNumber": "user_phone_number",
    "username": "user_name",
    "password": "user_password"
  }
  ```
- **Response**:
  ```json
  {
    "token": "JWT_token",
    "profileId": "user_profile_id",
    "username": "user_name",
    "message": "Registration successful"
  }
  ```

### 2. **POST** `/login`

- User login with phone number and password.
- **Request Body**:
  ```json
  {
    "phoneNumber": "user_phone_number",
    "password": "user_password"
  }
  ```
- **Response**:
  ```json
  {
    "token": "JWT_token",
    "profileId": "user_profile_id",
    "username": "user_name",
    "message": "Login successful"
  }
  ```

### 3. **POST** `/logout`

- User logout and disconnect from Socket.io.
- **Request Body**:
  ```json
  {
    "profileId": "user_profile_id"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Logout successful and connection terminated"
  }
  ```

## Real-time Messaging

- Once logged in, users can send and receive messages in real-time.
- Messages are stored in the MongoDB database and can be delivered when the recipient comes online.
- Offline users will receive undelivered messages once they log in again.

## .env Configuration

You need to create a `.env` file in the root of the project to store sensitive configuration like JWT secret and MongoDB URI.

### Example `.env` file:

```
JWT_SECRET=your_jwt_secret_key
MONGO_URI=your_mongo_connection_string
```
