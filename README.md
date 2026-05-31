# Personal Blog System

Monorepo for a low-traffic personal blog. The frontend is Vite + React with Tiptap. The backend is Go + Gin, PostgreSQL stores core data, Redis stores statistics/cache/events, and Aliyun OSS stores static article JSON/HTML/assets when enabled.

## Structure

```text
frontend/     Vite React app
backend/      Gin API service
database/     PostgreSQL init.sql
example.env   environment template
```

## Quick Start

1. Create `.env` from `example.env` and fill secrets.
2. Start PostgreSQL and Redis.
3. Initialize the database:

```bash
psql "$DATABASE_URL" -f database/init.sql
```

4. Start backend:

```bash
cd backend
go mod tidy
go run ./cmd/server
```

5. Start frontend:

```bash
cd frontend
npm install
npm run dev
```

Frontend defaults to `http://localhost:5173`, backend to `http://localhost:8080`.

Docker Compose alternative:

```bash
cp example.env .env
docker compose up --build
```

Compose starts PostgreSQL, Redis, backend and an Nginx-served frontend. The frontend is exposed on `http://localhost:5173`.

## Configuration

All runtime configuration is read from `.env` or process environment. `JWT_SECRET`, database credentials, Redis credentials and OSS keys are sensitive and must not be committed. In production set `COOKIE_SECURE=true` and use HTTPS.

## API Summary

All authenticated endpoints use an HttpOnly token cookie. Public read endpoints can be used without login.

### Register

`POST /register`

```json
{"username":"admin","email":"admin@example.com","password":"strong-password"}
```

Returns the user profile and sets the auth cookie.

### Login

`POST /login`

```json
{"username":"admin","password":"strong-password"}
```

Returns the user profile and sets the auth cookie.

### Posts

`GET /api/posts?page=1&page_size=10&category=tech&tag=go`

`GET /api/posts/:id`

`POST /api/posts` authenticated:

```json
{
  "title": "Hello",
  "slug": "hello",
  "summary": "Short summary",
  "status": "published",
  "category_id": 1,
  "tag_ids": [1, 2],
  "content_json": {"type":"doc","content":[]},
  "content_html": "<p>Hello</p>"
}
```

`PUT /api/posts/:id` and `DELETE /api/posts/:id` require authentication.

### Categories And Tags

`GET /api/categories`, `POST /api/categories`, `PUT /api/categories/:id`, `DELETE /api/categories/:id`

`GET /api/tags`, `POST /api/tags`, `PUT /api/tags/:id`, `DELETE /api/tags/:id`

### Statistics

`GET /api/stats/profile` returns Redis-backed totals, hot tags and recent activity.

## Redis Design

The backend updates Redis synchronously after database mutations:

- `user:{id}:post_count`
- `user:{id}:category_count`
- `user:{id}:tag_count`
- `user:{id}:activity`
- `user:{id}:hot_tags`
- `cache:posts:*`
- `cache:post:{id}`

Cache entries intentionally do not expire. Mutating handlers delete affected cache keys and publish an event on `events:blog`.

## Security

HTML is filtered twice: the frontend uses DOMPurify before submit, and the backend applies bluemonday before saving. The `posts.content_html` column is documented as sanitized HTML in `database/init.sql`.

Auth is token-based and sessionless. The JWT is stored in an HttpOnly cookie with SameSite protection. JavaScript cannot read the token. Use `Secure` cookies in production.

Passwords are hashed with bcrypt. Back up PostgreSQL regularly using `pg_dump`, even for small personal deployments.

## Deployment

Recommended production deployment:

- Build frontend with `npm run build` and serve `frontend/dist` through Nginx or object storage.
- Run the Go backend behind HTTPS.
- Keep PostgreSQL, Redis and OSS credentials in environment secrets.
- Run `database/init.sql` once, then manage schema changes through migrations.
- Restrict CORS to the real frontend origin.
