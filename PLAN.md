# Backend Development Plan — Social Media App

## Tech Stack
- **Framework:** NestJS 11
- **Database:** PostgreSQL + TypeORM
- **Auth:** JWT + Passport.js
- **Docs:** Swagger/OpenAPI
- **Realtime:** WebSockets (Socket.IO)
- **File Upload:** Multer
- **Validation:** class-validator + class-transformer

---

## Phase 1: Core Foundation
- [x] Database connection and TypeORM setup
- [x] User entity (id, email, username, password, bio, avatar, createdAt, updatedAt)
- [x] Authentication module (register, login, refresh token, logout)
- [x] JWT strategy and guards
- [x] Password hashing with bcrypt
- [x] Google OAuth login (passport-google-oauth20)
- [x] Facebook OAuth login (passport-facebook)
- [x] OAuth account linking (same email → link accounts)
- [x] Global validation pipe and error handling
- [ ] API versioning setup

## Phase 2: User Profiles
- [x] Get user profile by username
- [x] Update own profile (bio, avatar, display name)
- [x] Avatar upload (Multer + local storage)
- [x] User search (by username, name) with pagination
- [x] Account deactivation
- [x] Account deletion (anonymizes data)
- [x] Change password endpoint

## Phase 3: Posts & Feed
- [x] Post entity (id, content, images, userId, createdAt, updatedAt)
- [x] Create post (text only)
- [x] Create post with image uploads (up to 10 images)
- [x] Delete own post
- [x] Edit own post
- [x] Get single post with comments (nested replies)
- [x] Feed endpoint (posts from followed users, paginated)
- [x] Explore/discover endpoint (trending by likes, paginated)
- [x] Get posts by user (paginated)
- [x] Bookmark/save post
- [x] Remove bookmark
- [x] Get saved/bookmarked posts
- [x] Check bookmark status
- [x] All list endpoints return pagination metadata (page, total, hasNext, hasPrevious)

## Phase 4: Social Interactions
- [x] Like entity and endpoints (like/unlike post)
- [x] Like count on posts (denormalized counter)
- [x] Paginated likes list (who liked a post)
- [x] Comment entity (id, content, postId, userId, createdAt)
- [x] Add/delete/edit comment
- [x] Nested replies (parentId-based threading)
- [x] Get replies to a specific comment (paginated)
- [x] Follow/unfollow user
- [x] Remove follower
- [x] Followers/following list (paginated)
- [x] Mutual followers endpoint
- [x] Block user (removes follow relationships)
- [x] Unblock user
- [x] Blocked users list
- [x] Block status check
- [x] Block prevents follow attempts
- [x] Notifications triggered on: like, comment, reply, follow

## Phase 5: Messaging (Realtime)
- [x] Conversation entity (participants, lastMessage, updatedAt)
- [x] Message entity (id, content, senderId, conversationId, readAt, createdAt)
- [x] WebSocket gateway for real-time chat (/chat namespace)
- [x] Send/receive messages (REST + WebSocket)
- [x] Message read receipts (markAsRead)
- [x] Typing indicator events (typing/stopTyping)
- [x] Conversation list with last message and unread count
- [x] Total unread messages count endpoint
- [x] Delete own message
- [x] Delete conversation (and all messages)
- [x] Paginated messages within conversation
- [x] Online status tracking (supports multiple tabs)
- [x] Get online users via WebSocket
- [x] Mark read via WebSocket (notifies other participant)
- [x] Broadcast message notifications to non-active users

## Phase 6: Notifications
- [x] Notification entity (id, type, actorId, targetUserId, postId, read, createdAt)
- [x] Notification types: like, comment, follow, message, mention
- [x] Real-time notifications via WebSocket (/notifications namespace)
- [x] Auto-triggered from likes, comments, replies, follows
- [x] Respects user notification preferences before creating
- [x] Mark as read / mark all as read (updates unread count in real-time)
- [x] Filter notifications by type (query param)
- [x] Delete single notification
- [x] Delete all notifications
- [x] Paginated notification list
- [x] Unread count endpoint + real-time unread count push
- [x] Notification preferences entity (per-type toggle)
- [x] Get preferences endpoint
- [x] Update preferences endpoint

## Phase 7: Advanced Features
- [x] Hashtags entity + auto-parsing from post content (#tag extraction)
- [x] Trending hashtags endpoint (ordered by post count)
- [x] Search hashtags by prefix
- [x] Get posts by hashtag (paginated)
- [x] Mentions (@username) — auto-parsed from content, sends notification
- [x] Bookmarks/saved posts (completed in Phase 3)
- [x] Post sharing/repost (repost, remove repost, who reposted, status)
- [x] Repost count on posts (denormalized counter)
- [x] Story-like ephemeral posts (24h visibility)
- [x] Create story (with image upload)
- [x] Feed stories (grouped by user, only from followed users)
- [x] View story (tracks unique viewers)
- [x] Get story viewers (author only)
- [x] Delete own story
- [x] Content reporting system (post, comment, or user)
- [x] Duplicate report prevention
- [x] View my submitted reports

## Phase 8: Performance & Production
- [x] Pagination (offset-based for all endpoints with PaginatedResponseDto)
- [x] Rate limiting (@nestjs/throttler — 3 tiers: short/medium/long)
- [x] Database indexing optimization (migration with indexes on frequent queries)
- [x] File storage abstraction (pluggable: local or S3 via STORAGE_TYPE env)
- [x] S3 integration (upload, delete, signed URLs)
- [x] Local storage fallback
- [x] Email service (nodemailer with SMTP config)
- [x] Password reset flow (forgot password + reset with token)
- [x] Email templates (verification, password reset)
- [x] Logging and monitoring (Winston with file + console transports)
- [x] Structured logging (error.log, combined.log with rotation)

---

## Folder Structure
```
backend/
├── src/
│   ├── auth/           → Authentication (JWT, login, register)
│   │   ├── dto/
│   │   ├── guards/
│   │   └── strategies/
│   ├── users/          → User profiles, search
│   │   ├── dto/
│   │   └── entities/
│   ├── posts/          → Posts CRUD, feed
│   │   ├── dto/
│   │   └── entities/
│   ├── comments/       → Comments on posts
│   │   ├── dto/
│   │   └── entities/
│   ├── likes/          → Like/unlike
│   │   └── entities/
│   ├── follows/        → Follow/unfollow
│   │   └── entities/
│   ├── messages/       → Real-time chat
│   │   ├── dto/
│   │   └── entities/
│   ├── notifications/  → Push & in-app notifications
│   │   ├── dto/
│   │   └── entities/
│   ├── media/          → File uploads
│   │   ├── dto/
│   │   └── entities/
│   ├── common/         → Shared utilities
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── pipes/
│   ├── config/         → App configuration
│   └── database/       → Migrations & seeds
│       ├── migrations/
│       └── seeds/
├── uploads/            → Local file uploads
├── test/               → E2E tests
├── .env.example
└── package.json
```

## Scripts
- `npm run start:dev` — Development server with hot reload
- `npm run build` — Production build
- `npm run start:prod` — Run production build
- `npm run lint` — ESLint
- `npm run test` — Unit tests
- `npm run test:e2e` — End-to-end tests
