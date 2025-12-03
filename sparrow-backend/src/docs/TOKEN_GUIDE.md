# 🔐 Access Token & Refresh Token Guide

Complete guide to understanding and using JWT tokens in Sparrow API.

## 📋 Table of Contents

1. [Token Overview](#token-overview)
2. [Token Specifications](#token-specifications)
3. [Token Lifecycle](#token-lifecycle)
4. [All Use Cases](#all-use-cases)
5. [Error Handling](#error-handling)
6. [Security Best Practices](#security-best-practices)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Token Overview

### What are Access Tokens and Refresh Tokens?

**Access Token:**

- Short-lived JWT token (15 minutes)
- Used to authenticate API requests
- Sent in `Authorization: Bearer <token>` header
- Contains user information (userId, profileId, email, username)
- **Expires quickly for security** - if compromised, damage is limited

**Refresh Token:**

- Long-lived JWT token (30 days)
- Used ONLY to get new access tokens
- Stored in database (can be revoked)
- Sent in request body to refresh endpoint
- **Never sent with regular API requests**

---

## 📊 Token Specifications

### Access Token

```javascript
{
  // Token Payload
  userId: "user-1759994481821",
  profileId: "user-1759994481821",
  email: null,
  username: "purushoth",
  iat: 1764697987,        // Issued at (timestamp)
  exp: 1764698887         // Expires at (timestamp, 15 minutes later)
}

// Expiration: 15 minutes
// Algorithm: HS256
// Secret: JWT_ACCESS_SECRET (from environment)
```

### Refresh Token

```javascript
{
  // Token Payload
  userId: "user-1759994481821",
  profileId: "user-1759994481821",
  email: null,
  username: "purushoth",
  type: "refresh",        // Identifies as refresh token
  iat: 1764697987,        // Issued at (timestamp)
  exp: 1767289987         // Expires at (timestamp, 30 days later)
}

// Expiration: 30 days
// Algorithm: HS256
// Secret: JWT_REFRESH_SECRET (from environment)
// Stored: In database (User.refreshTokens array)
```

---

## 🔄 Token Lifecycle

### 1. Login Flow

```
User Login
    ↓
POST /api/auth/mobile/login
    ↓
Server validates credentials
    ↓
Server generates:
  - accessToken (15 min expiry)
  - refreshToken (30 day expiry)
    ↓
refreshToken stored in database
    ↓
Both tokens returned to client
```

### 2. Using Access Token

```
Client makes API request
    ↓
Adds header: Authorization: Bearer <accessToken>
    ↓
Server middleware verifies token
    ↓
If valid: Request proceeds
If expired: Returns 401 "Token expired"
If invalid: Returns 401 "Invalid token"
```

### 3. Refresh Flow

```
Access Token Expires
    ↓
Client receives 401 "Token expired"
    ↓
Client calls POST /api/auth/mobile/refresh
    ↓
Sends refreshToken in request body
    ↓
Server verifies refreshToken:
  - Checks JWT signature
  - Checks expiration
  - Checks if token exists in database
  - Checks if user still exists
    ↓
If valid: Returns new accessToken
If invalid: Returns 401 error
```

### 4. Logout Flow

```
User Logout
    ↓
POST /api/auth/mobile/logout
    ↓
Sends refreshToken in request body
    ↓
Server removes refreshToken from database
    ↓
Token is invalidated (cannot be used again)
```

---

## 📝 All Use Cases

### Case 1: Successful Login

**Request:**

```http
POST /api/auth/mobile/login
Content-Type: application/json

{
  "identifier": "purushoth",
  "password": "Purushoth@123"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "profileId": "user-1759994481821",
      "username": "purushoth",
      "email": null,
      "phoneNumber": "+18778441493",
      "fullName": "Purushothaman",
      "profileImage": ""
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "passwordWarning": null
  }
}
```

**What to do:**

1. Store both tokens securely (accessToken in memory, refreshToken in secure storage)
2. Use `accessToken` for all API requests
3. Save `refreshToken` for when accessToken expires

---

### Case 2: Making Authenticated Requests

**Request:**

```http
GET /api/user
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**

```json
{
  "success": true,
  "user": {
    "profileId": "user-1759994481821",
    "username": "purushoth",
    ...
  }
}
```

**What happens:**

- Middleware extracts token from `Authorization` header
- Verifies token signature and expiration
- Attaches user to `req.user`
- Request proceeds

---

### Case 3: Access Token Expired (Normal Flow)

**Request:**

```http
GET /api/user
Authorization: Bearer <expired-accessToken>
```

**Response (401 Unauthorized):**

```json
{
  "success": false,
  "error": "Token expired",
  "message": "Token expired"
}
```

**What to do:**

1. Catch 401 error
2. Call refresh endpoint with refreshToken
3. Get new accessToken
4. Retry original request with new accessToken

---

### Case 4: Refreshing Access Token

**Request:**

```http
POST /api/auth/mobile/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**What happens:**

- Server verifies refreshToken signature
- Checks if refreshToken exists in database
- Verifies user still exists
- Generates new accessToken (15 min expiry)
- Returns new accessToken (refreshToken stays the same)

**Note:** Refresh token is NOT rotated - same token can be used multiple times until it expires.

---

### Case 5: Refresh Token Expired

**Request:**

```http
POST /api/auth/mobile/refresh
Content-Type: application/json

{
  "refreshToken": "<expired-refreshToken>"
}
```

**Response (401 Unauthorized):**

```json
{
  "success": false,
  "error": "Refresh token expired",
  "message": "Refresh token expired"
}
```

**What to do:**

- User must login again
- Cannot refresh - refreshToken has expired (30 days passed)
- Need to call `POST /api/auth/mobile/login` again

---

### Case 6: Invalid Refresh Token

**Request:**

```http
POST /api/auth/mobile/refresh
Content-Type: application/json

{
  "refreshToken": "invalid-token-here"
}
```

**Response (401 Unauthorized):**

```json
{
  "success": false,
  "error": "Invalid refresh token",
  "message": "Invalid refresh token"
}
```

**Possible causes:**

- Token was tampered with
- Token was revoked (user logged out)
- Token doesn't exist in database
- Wrong token type (using accessToken instead of refreshToken)

---

### Case 7: Refresh Token Revoked (Logout)

**Scenario:**

1. User logs out → refreshToken removed from database
2. User tries to refresh → token not found in database

**Request:**

```http
POST /api/auth/mobile/refresh
Content-Type: application/json

{
  "refreshToken": "<revoked-refreshToken>"
}
```

**Response (401 Unauthorized):**

```json
{
  "success": false,
  "error": "Invalid refresh token",
  "message": "Invalid refresh token"
}
```

**What happens:**

- Token signature is valid
- But token doesn't exist in database (was removed on logout)
- Server rejects the token

---

### Case 8: User Deleted While Token Valid

**Scenario:**

1. User has valid tokens
2. Admin deletes user account
3. User tries to use accessToken or refreshToken

**Request:**

```http
GET /api/user
Authorization: Bearer <valid-accessToken>
```

**Response (401 Unauthorized):**

```json
{
  "success": false,
  "error": "User not found",
  "message": "User not found"
}
```

**What happens:**

- Token is valid (not expired, signature OK)
- But user doesn't exist in database
- Server rejects the request

---

### Case 9: Logout (Invalidate Refresh Token)

**Request:**

```http
POST /api/auth/mobile/logout
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Logout successful",
  "data": null
}
```

**What happens:**

- Server removes refreshToken from database
- refreshToken can no longer be used
- accessToken becomes useless (can't refresh)
- User must login again

**Note:** Logout doesn't require accessToken - only refreshToken is needed.

---

### Case 10: Multiple Devices (Multiple Refresh Tokens)

**Scenario:**

- User logs in on Phone → gets refreshToken1
- User logs in on Tablet → gets refreshToken2
- Both tokens stored in database (User.refreshTokens array)

**Behavior:**

- Each device has its own refreshToken
- Logging out from one device only removes that device's refreshToken
- Other devices continue to work
- To logout all devices, need to remove all refreshTokens (not implemented yet)

---

## ⚠️ Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "message": "Error description"
}
```

### Common Error Codes

| Status Code | Error Message             | Meaning                      | Solution              |
| ----------- | ------------------------- | ---------------------------- | --------------------- |
| 400         | Invalid credentials       | Wrong username/password      | Check credentials     |
| 400         | Refresh token is required | Missing refreshToken in body | Include refreshToken  |
| 401         | Token expired             | Access token expired         | Call refresh endpoint |
| 401         | Refresh token expired     | Refresh token expired        | Login again           |
| 401         | Invalid token             | Token signature invalid      | Login again           |
| 401         | Invalid refresh token     | Token not in database        | Login again           |
| 401         | User not found            | User account deleted         | Login again           |
| 423         | Account locked            | Too many failed attempts     | Wait or contact admin |

---

## 🔒 Security Best Practices

### For Clients (Mobile Apps)

1. **Store Tokens Securely**

   - ✅ AccessToken: In memory only (don't persist)
   - ✅ RefreshToken: In secure storage (Keychain on iOS, Keystore on Android)
   - ❌ Never store in SharedPreferences/UserDefaults
   - ❌ Never log tokens to console

2. **Token Refresh Strategy**

   - Refresh accessToken before it expires (e.g., at 14 minutes)
   - Implement automatic retry with refresh on 401 errors
   - Handle refresh failures gracefully (redirect to login)

3. **Token Usage**

   - ✅ Use accessToken for all API requests
   - ❌ Never use refreshToken for API requests
   - ❌ Never send tokens in URL parameters
   - ✅ Always use HTTPS

4. **Logout**
   - Always call logout endpoint when user logs out
   - Clear tokens from storage
   - Don't rely on token expiration alone

### For Server

1. **Token Validation**

   - Always verify token signature
   - Always check token expiration
   - Always verify refreshToken exists in database
   - Always check user still exists

2. **Token Storage**

   - RefreshTokens stored in database (can be revoked)
   - AccessTokens not stored (stateless)
   - Use different secrets for access and refresh tokens

3. **Security Headers**
   - Use HTTPS in production
   - Set appropriate CORS policies
   - Rate limit authentication endpoints

---

## 🐛 Troubleshooting

### Problem: "Token expired" immediately after login

**Possible causes:**

- Server time is incorrect
- Token expiry time misconfigured
- Client time is incorrect

**Solution:**

- Check server time is synchronized (NTP)
- Verify `JWT_ACCESS_SECRET` and `ACCESS_TOKEN_EXPIRY` in environment

---

### Problem: "Invalid refresh token" after logout

**This is expected behavior:**

- Logout removes refreshToken from database
- Token can no longer be used
- User must login again

---

### Problem: Can't refresh token after 30 days

**This is expected behavior:**

- RefreshToken expires after 30 days
- User must login again
- This is a security feature

---

### Problem: Multiple refresh tokens not working

**Check:**

- Database has `refreshTokens` array field
- Tokens are being added with `$addToSet` (not overwritten)
- Each login creates a new token

---

## 📚 Quick Reference

### Token Comparison

| Feature        | Access Token                    | Refresh Token                    |
| -------------- | ------------------------------- | -------------------------------- |
| **Expiration** | 15 minutes                      | 30 days                          |
| **Usage**      | API requests                    | Refresh endpoint only            |
| **Storage**    | Client memory                   | Database + Client secure storage |
| **Revocable**  | No (stateless)                  | Yes (stored in DB)               |
| **Header**     | `Authorization: Bearer <token>` | Request body                     |
| **Rotation**   | New on each refresh             | Same until expiry                |

### API Endpoints

| Endpoint                   | Method | Purpose                 | Auth Required           |
| -------------------------- | ------ | ----------------------- | ----------------------- |
| `/api/auth/mobile/login`   | POST   | Get tokens              | No                      |
| `/api/auth/mobile/refresh` | POST   | Get new accessToken     | No (needs refreshToken) |
| `/api/auth/mobile/logout`  | POST   | Invalidate refreshToken | No (needs refreshToken) |
| `/api/user`                | GET    | Get user profile        | Yes (accessToken)       |
| `/api/friends`             | GET    | Get friends             | Yes (accessToken)       |

---

## 💡 Example Implementation

### Client-Side Token Management (Pseudo-code)

```javascript
class TokenManager {
  constructor() {
    this.accessToken = null; // In memory
    this.refreshToken = null; // In secure storage
  }

  async login(credentials) {
    const response = await api.post("/api/auth/mobile/login", credentials);
    this.accessToken = response.data.data.accessToken;
    await this.saveRefreshToken(response.data.data.refreshToken);
  }

  async makeRequest(url, options = {}) {
    // Add access token to request
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${this.accessToken}`,
    };

    try {
      return await api.request({ ...options, url, headers });
    } catch (error) {
      if (
        error.response?.status === 401 &&
        error.response?.data?.error === "Token expired"
      ) {
        // Refresh token and retry
        await this.refreshAccessToken();
        headers["Authorization"] = `Bearer ${this.accessToken}`;
        return await api.request({ ...options, url, headers });
      }
      throw error;
    }
  }

  async refreshAccessToken() {
    const refreshToken = await this.getRefreshToken();
    const response = await api.post("/api/auth/mobile/refresh", {
      refreshToken,
    });
    this.accessToken = response.data.data.accessToken;
  }

  async logout() {
    const refreshToken = await this.getRefreshToken();
    await api.post("/api/auth/mobile/logout", { refreshToken });
    this.accessToken = null;
    await this.clearRefreshToken();
  }
}
```

---

## ✅ Summary

1. **AccessToken**: Short-lived (15 min), use for API requests
2. **RefreshToken**: Long-lived (30 days), use only to refresh accessToken
3. **Refresh Flow**: When accessToken expires → use refreshToken to get new accessToken
4. **Logout**: Removes refreshToken from database → user must login again
5. **Security**: Tokens are signed, verified, and refreshTokens are revocable

For questions or issues, check the error messages and status codes in the responses.
