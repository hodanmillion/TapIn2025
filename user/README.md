# User Service

Extended user profile and social features service built with Node.js, Express, TypeScript, and Prisma.

## 🏗️ Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         USER SERVICE (Node.js + Express)                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                  PORT 3002                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│    ROUTE HANDLERS   │    │      SERVICES       │    │     DATA LAYER      │
├─────────────────────┤    ├─────────────────────┤    ├─────────────────────┤
│                     │    │                     │    │                     │
│ 👤 Profile Routes   │───▶│ 🗄️ Cache Service    │───▶│ 🗃️ PostgreSQL       │
│  • GET /me          │    │  • Redis Caching   │    │  • User Profiles    │
│  • PUT /me          │    │  • Cache Invalidation│    │  • Social Relations │
│  • GET /:username   │    │                     │    │  • User Interests   │
│                     │    │ 📤 Event Service    │───▶│  • Upload Metadata  │
│ 👥 Social Routes    │───▶│  • User Events      │    │                     │
│  • POST /follow     │    │  • Activity Stream  │    │ 🔴 Redis Cache      │
│  • DELETE /unfollow │    │  • Notifications    │    │  • Profile Cache    │
│  • GET /followers   │    │                     │    │  • Search Cache     │
│  • GET /following   │    │ 🔍 Search Service   │───▶│  • Social Cache     │
│                     │    │  • User Search      │    │                     │
│ 🔍 Search Routes    │───▶│  • Fuzzy Matching   │    │ ☁️ AWS S3           │
│  • GET /users       │    │  • Result Ranking   │    │  • Avatar Storage   │
│                     │    │                     │    │  • File Management  │
│ ⚙️ Settings Routes  │───▶│ 📁 S3 Service       │───▶│                     │
│  • GET /preferences │    │  • File Upload      │    │ 🔔 Event Queue      │
│  • PUT /preferences │    │  • Image Processing │    │  • User Events      │
│  • POST /interests  │    │  • URL Generation   │    │  • Social Events    │
│                     │    │                     │    │  • System Events    │
│ 📁 Upload Routes    │───▶│ 🔄 Queue Service    │───▶│                     │
│  • POST /avatar     │    │  • Background Jobs  │    │                     │
│                     │    │  • Event Processing │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MIDDLEWARE LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 🔒 Auth Middleware    │ 📝 Validation         │ 🛡️ Error Handler              │
│  • JWT Verification   │  • Request Validation │  • Global Error Handling      │
│  • User Context      │  • Schema Validation  │  • HTTP Status Codes          │
│                       │  • Sanitization       │  • Error Logging              │
│ 📊 Logging           │ 🔧 Multer Upload      │ ⚡ Performance                 │
│  • Request Logging    │  • File Upload        │  • Response Time              │
│  • Performance Logs  │  • File Validation    │  • Memory Usage               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 📊 Function Flow Diagram

### Profile Management Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  GET PROFILE│    │ UPDATE      │    │ SEARCH      │    │ UPLOAD      │
│     /me     │    │ PROFILE     │    │  USERS      │    │  AVATAR     │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Check Cache │    │ Validate    │    │ Check Cache │    │ Validate    │
│ for Profile │    │ Input Data  │    │ for Results │    │ File Type   │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ If Cached:  │    │ Update      │    │ If Cached:  │    │ Upload to   │
│ Return Data │    │ Database    │    │ Return Data │    │ S3 Bucket   │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ If Not:     │    │ Invalidate  │    │ If Not:     │    │ Update User │
│ Query DB    │    │ Cache       │    │ Query DB    │    │ Avatar URL  │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Cache       │    │ Emit Event  │    │ Cache       │    │ Emit Event  │
│ Result      │    │ (Profile    │    │ Results     │    │ (Avatar     │
└─────┬───────┘    │ Updated)    │    └─────┬───────┘    │ Updated)    │
      │            └─────┬───────┘          │            └─────┬───────┘
      ▼                  │                  ▼                  │
┌─────────────┐          ▼            ┌─────────────┐          ▼
│ Return      │    ┌─────────────┐    │ Return      │    ┌─────────────┐
│ Profile     │    │ Return      │    │ Search      │    │ Return      │
│ Data        │    │ Updated     │    │ Results     │    │ Avatar URL  │
└─────────────┘    │ Profile     │    └─────────────┘    └─────────────┘
                   └─────────────┘
```

### Social Features Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   FOLLOW    │    │  UNFOLLOW   │    │ GET         │    │ GET         │
│    USER     │    │    USER     │    │ FOLLOWERS   │    │ FOLLOWING   │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Validate    │    │ Validate    │    │ Check Cache │    │ Check Cache │
│ Target User │    │ Target User │    │ for List    │    │ for List    │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Check Not   │    │ Check       │    │ If Cached:  │    │ If Cached:  │
│ Already     │    │ Following   │    │ Return List │    │ Return List │
│ Following   │    │ Exists      │    └─────┬───────┘    └─────┬───────┘
└─────┬───────┘    └─────┬───────┘          │                  │
      │                  │                  ▼                  ▼
      ▼                  ▼            ┌─────────────┐    ┌─────────────┐
┌─────────────┐    ┌─────────────┐    │ If Not:     │    │ If Not:     │
│ Create      │    │ Delete      │    │ Query DB    │    │ Query DB    │
│ Follow      │    │ Follow      │    └─────┬───────┘    └─────┬───────┘
│ Record      │    │ Record      │          │                  │
└─────┬───────┘    └─────┬───────┘          ▼                  ▼
      │                  │            ┌─────────────┐    ┌─────────────┐
      ▼                  ▼            │ Cache       │    │ Cache       │
┌─────────────┐    ┌─────────────┐    │ Results     │    │ Results     │
│ Update      │    │ Update      │    └─────┬───────┘    └─────┬───────┘
│ Counters    │    │ Counters    │          │                  │
└─────┬───────┘    └─────┬───────┘          ▼                  ▼
      │                  │            ┌─────────────┐    ┌─────────────┐
      ▼                  ▼            │ Return      │    │ Return      │
┌─────────────┐    ┌─────────────┐    │ Follower    │    │ Following   │
│ Invalidate  │    │ Invalidate  │    │ List        │    │ List        │
│ Caches      │    │ Caches      │    └─────────────┘    └─────────────┘
└─────┬───────┘    └─────┬───────┘
      │                  │
      ▼                  ▼
┌─────────────┐    ┌─────────────┐
│ Emit Event  │    │ Emit Event  │
│ (Followed)  │    │ (Unfollowed)│
└─────┬───────┘    └─────┬───────┘
      │                  │
      ▼                  ▼
┌─────────────┐    ┌─────────────┐
│ Return      │    │ Return      │
│ Success     │    │ Success     │
└─────────────┘    └─────────────┘
```

## 🔗 API Endpoints

### Profile Management (`/api/v1/profile/`)
- **GET** `/me` - Get current user's extended profile
- **PUT** `/me` - Update user profile (display name, bio, location, etc.)
- **GET** `/:username` - Get public profile by username

### Social Features (`/api/v1/social/`)
- **POST** `/follow/:userId` - Follow another user
- **DELETE** `/unfollow/:userId` - Unfollow a user
- **GET** `/followers` - Get user's followers list
- **GET** `/following` - Get users that current user follows

### Search (`/api/v1/search/`)
- **GET** `/users?q=query` - Search users by name or username

### Settings (`/api/v1/settings/`)
- **GET** `/preferences` - Get user preferences and privacy settings
- **PUT** `/preferences` - Update user preferences
- **POST** `/interests` - Update user interests/tags

### File Upload (`/api/v1/upload/`)
- **POST** `/avatar` - Upload user avatar image

## 🔧 Core Components

### Services
- **CacheService**: Redis-based caching for performance optimization
- **EventService**: Event publishing for inter-service communication
- **QueueService**: Background job processing
- **S3Service**: File upload and management

### Data Models (Prisma)
- **UserProfile**: Extended user information
- **Follow**: Social relationship tracking
- **UserInterest**: User interest/tag associations
- **UploadMeta**: File upload metadata

### Features
- **Profile Management**: Extended user profiles with rich metadata
- **Social Graph**: Follow/unfollow relationships with caching
- **User Search**: Fast fuzzy search with result caching
- **File Uploads**: Avatar management with S3 integration
- **Event System**: Real-time notifications and activity streams
- **Cache Strategy**: Multi-layer caching for optimal performance

## 🚀 Development

### Environment Variables
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/user_db
REDIS_URL=redis://localhost:6379
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=user-uploads
EVENT_SERVICE_URL=http://localhost:8002
```

### Running the Service
```bash
npm install
npm run dev
```

### Database Operations
```bash
# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Reset database
npx prisma migrate reset
```

## 🧪 Testing
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

### Test Coverage Areas
- Route handlers with various input scenarios
- Service layer logic and error handling
- Cache invalidation strategies
- File upload validation and processing
- Social relationship edge cases