# AGENTS.md — Backend Agent Execution Rules (Node/Express + MongoDB)

These rules apply to any AI agent modifying or operating in `Procesos_Back/`.

## 0) Goal
Ship working features fast while preventing accidental data loss.
Agents are allowed to connect to the database for inspection and development.

## 1) No Guessing
If any business requirement, field meaning, or endpoint behavior is ambiguous:
- Ask a clarification OR
- Implement the safest placeholder behavior and mark it clearly as `TODO` / `PENDIENTE`.

## 2) Database Access Policy (MongoDB)
Backend uses MongoDB (Mongoose).

### Allowed without asking
Agents MAY perform **read-only** operations freely:
- find / findOne / aggregate / count / listCollections
- explain() / index listing

### Write operations (low-friction safety)
Agents MAY perform write operations (insert/update/delete/index/DDL-equivalent) **only after**:
1) Logging a short execution plan in the PR/commit message or task notes:
   - what will change
   - which collections
   - expected impact
2) Taking a minimal backup/snapshot approach suitable for dev:
   - export affected documents or ensure a dump exists for the target DB
3) Executing the change in the smallest scope possible
4) Verifying results (sample queries)

This is NOT a "permission gate"; it is a "safety checklist" to keep velocity high and avoid irreversible mistakes.

## 3) Environment & Secrets
- Never hardcode DB URIs, JWT secrets, API keys.
- Use `.env` locally and provide `.env.example` in the repo.
- `.env` must not be committed.

Required env vars (minimum):
- `MONGO_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `PORT`

## 4) Implementation Discipline
- Any concrete change must compile/run.
- Prefer small, incremental changes.
- Provide tests when feasible (at least smoke tests).

## 5) API Standards
- All endpoints must validate inputs (zod/joi/express-validator).
- Return consistent error format:
  `{ "message": string, "details"?: any }`
- Use proper HTTP status codes.

## 6) Auth & Security Baseline
- JWT auth middleware required for protected routes.
- Passwords must be hashed (bcrypt).
- Rate limiting recommended for auth endpoints (login/register) in production.

## 7) Repo Conventions
Suggested structure:
- `src/`
  - `config/`
  - `models/`
  - `controllers/`
  - `routes/`
  - `middleware/`
  - `utils/`
- Use TypeScript if the project is TS; otherwise keep JS consistent.

## 8) Git Workflow
- Commit after each completed task chunk.
- Atomic commits with clear messages:
  - `feat(auth): add JWT login`
  - `fix(users): validate email uniqueness`
  - `chore(env): add .env.example`