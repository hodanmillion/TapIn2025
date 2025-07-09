# Auth Service

JWT-based authentication and user management service built with Go, Gin, and PostgreSQL.

## 🏗️ Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AUTH SERVICE (Go + Gin)                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                  PORT 8080                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│    HTTP HANDLERS    │    │      SERVICES       │    │     DATA LAYER      │
├─────────────────────┤    ├─────────────────────┤    ├─────────────────────┤
│                     │    │                     │    │                     │
│ 🔐 Auth Handler     │───▶│ 🔐 Auth Service     │───▶│ 🗃️ PostgreSQL       │
│  • Register         │    │  • User Registration│    │  • Users Table      │
│  • Login            │    │  • Password Hashing │    │  • Sessions Table   │
│  • RefreshToken     │    │  • Login Validation │    │                     │
│  • Logout           │    │                     │    │ 🔴 Redis Cache      │
│  • VerifyEmail      │    │ 🔑 Token Service    │───▶│  • JWT Blacklist    │
│  • ForgotPassword   │    │  • JWT Generation   │    │  • Session Storage  │
│  • ResetPassword    │    │  • Token Validation │    │  • Rate Limiting    │
│                     │    │  • Refresh Logic    │    │                     │
│ 👤 User Handler     │───▶│                     │    │ 📧 Email Events     │
│  • GetCurrentUser   │    │ 👤 User Service     │───▶│  • User Created     │
│  • UpdateProfile    │    │  • Profile Updates  │    │  • Password Reset   │
│  • ChangePassword   │    │  • Account Deletion │    │  • Email Verified   │
│  • DeleteAccount    │    │  • User Queries     │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MIDDLEWARE LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 🔒 Auth Middleware    │ 🌐 CORS Middleware    │ 📝 Logger Middleware           │
│  • JWT Validation     │  • Cross-Origin       │  • Request Logging            │
│  • Route Protection   │  • Preflight Handling │  • Error Logging              │
│                       │                       │                               │
│ ⏱️ Rate Limit         │ 🛡️ Security Headers   │ 🔧 Recovery Middleware        │
│  • Per-User Limits    │  • CSRF Protection    │  • Panic Recovery             │
│  • IP-based Limiting  │  • Headers Injection  │  • Error Handling             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 📊 Function Flow Diagram

### Authentication Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  REGISTER   │    │    LOGIN    │    │   REFRESH   │    │   LOGOUT    │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Validate    │    │ Validate    │    │ Validate    │    │ Validate    │
│ Input       │    │ Credentials │    │ Refresh     │    │ Access      │
└─────┬───────┘    └─────┬───────┘    │ Token       │    │ Token       │
      │                  │            └─────┬───────┘    └─────┬───────┘
      ▼                  ▼                  │                  │
┌─────────────┐    ┌─────────────┐          ▼                  ▼
│ Hash        │    │ Verify      │    ┌─────────────┐    ┌─────────────┐
│ Password    │    │ Password    │    │ Generate    │    │ Blacklist   │
└─────┬───────┘    └─────┬───────┘    │ New Tokens  │    │ Token       │
      │                  │            └─────┬───────┘    └─────┬───────┘
      ▼                  ▼                  │                  │
┌─────────────┐    ┌─────────────┐          ▼                  ▼
│ Create User │    │ Generate    │    ┌─────────────┐    ┌─────────────┐
│ in Database │    │ JWT Tokens  │    │ Return      │    │ Invalidate  │
└─────┬───────┘    └─────┬───────┘    │ New Tokens  │    │ Session     │
      │                  │            └─────────────┘    └─────┬───────┘
      ▼                  ▼                                     │
┌─────────────┐    ┌─────────────┐                            ▼
│ Send        │    │ Store       │                      ┌─────────────┐
│ Welcome     │    │ Session     │                      │ Confirm     │
│ Email       │    │ in Redis    │                      │ Logout      │
└─────┬───────┘    └─────┬───────┘                      └─────────────┘
      │                  │
      ▼                  ▼
┌─────────────┐    ┌─────────────┐
│ Return      │    │ Return      │
│ User Info   │    │ Tokens      │
└─────────────┘    └─────────────┘
```

## 🔗 API Endpoints

### Authentication Endpoints (`/api/v1/auth/`)
- **POST** `/register` - Create new user account
- **POST** `/login` - Authenticate user and return tokens
- **POST** `/refresh` - Generate new access token using refresh token
- **POST** `/logout` - Invalidate user session
- **POST** `/verify-email` - Verify user email address
- **POST** `/forgot-password` - Initiate password reset
- **POST** `/reset-password` - Complete password reset

### User Management Endpoints (`/api/v1/users/`)
- **GET** `/me` - Get current user profile
- **PUT** `/me` - Update user profile
- **PUT** `/change-password` - Change user password
- **DELETE** `/me` - Delete user account

## 🔧 Core Components

### Services
- **AuthService**: User registration, login, password management
- **UserService**: Profile management, account operations  
- **TokenService**: JWT generation, validation, refresh logic

### Data Models
- **User**: Core user entity with authentication fields
- **Session**: Active user sessions with expiration
- **RegisterRequest**: User registration input validation
- **LoginRequest**: Login credentials validation

### Security Features
- **Password Hashing**: bcrypt with configurable cost
- **JWT Tokens**: Access and refresh token pair
- **Rate Limiting**: Per-user and IP-based limits
- **Session Management**: Redis-backed session storage
- **Email Verification**: Account verification workflow
- **Password Reset**: Secure reset token system

## 🚀 Development

### Environment Variables
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=auth_db
DB_USER=postgres
DB_PASSWORD=password
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
EMAIL_SERVICE_URL=http://localhost:8001
```

### Running the Service
```bash
go run main.go
```

### Database Migrations
```bash
# Run migrations
psql -h localhost -U postgres -d auth_db -f migrations/001_initial.sql
```

## 🧪 Testing
```bash
# Run all tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Run integration tests
go test -tags integration ./...
```