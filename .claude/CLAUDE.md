# Vote-Tracker Coding Standards

## Project Overview
Discord Vote Tracker Bot - TypeScript application tracking votes for Discord bots/servers.

## Tech Stack
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose
- **Caching**: MemoryCache + RedisCache
- **Queue**: BullMQ (RedisQueue)
- **Workers**: WorkerLoader (loads from `/Workers`)
- **Cron Jobs**: CronJobsLoader (loads from `/CronJobs`)
- **Rate Limiting**: IP-based middleware

## Project Structure
```
src/
├── API/          # Discord, rate limit, HTTP client
├── Commands/     # Discord slash commands
├── Middlewares/  # Rate limiting, CORS, auth
├── Routes/       # API endpoints
├── Schemas/      # MongoDB models
├── Types/        # TypeScript definitions
└── Utils/        # Global functions
```

## Strict Coding Rules

### 1. NO Code Comments
Never add comments to the code. Code should be self-documenting through descriptive names.

### 1.1 NO ANY
Never use the type any, typing is there for a reason.

### 1.2 Typing ALWAYS in the /@Typing directory
Always use the `/@Typing` directory for TypeScript definitions to keep them organized and easily accessible.

### 1.3 Typing styel
- Interfaces always start with `I`
- Enums always start with `E`
- Types always start with `T`

### 2. Descriptive Names Only
- **Variables**: Use full descriptive names
  - ❌ `usr`, `usrId`, `tmp`
  - ✅ `user`, `userId`, `temporaryData`
- **Functions**: Full descriptive names
  - ❌ `getUsr()`, `chkVal()`
  - ✅ `getUser()`, `checkValue()`

### 3. No Code Duplication
- Extract duplicated logic into global functions in `src/Utils/`
- Reuse existing utilities instead of rewriting
- Check `src/Utils/` before creating new helpers

### 4. Use Workers/Cronjobs for Rate Limit Prevention
- For rate-limited APIs, use workers (`/Workers` directory)
- For scheduled tasks, use cronjobs (`/CronJobs` directory)
- Worker system: BullMQ via `RedisQueue.ts`
- Both loaders exist but are currently disabled in `index.ts`

## Architecture Patterns
- Singleton pattern for services (Redis, Cache, Discord)
- Class-based design with `execute()` method pattern
- Constructor-based dependency injection
- Loader pattern for auto-discovery

## Entry Point
- Main file: `index.ts`
- Initialization order: Env vars → HTTP client → MongoDB → Discord commands → Middlewares → Routes → Server
