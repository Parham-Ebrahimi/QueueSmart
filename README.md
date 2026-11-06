# QueueSmart

QueueSmart is a campus queue-management app. Members join a service queue and watch their place in line. Administrators create services, open or close queues, reorder or remove visitors, and serve the next person.

The repository includes the Assignment 2 frontend, Assignment 3 Express API, and Assignment 4 account database. Service and queue data still use the existing A3 stores.

## Run locally

```bash
npm install
npm run dev
```

In a second terminal, run `npm install` and `npm start` from `server/` to start the API. The frontend proxies `/api` requests to that server.

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Register with your full name, email, and an 8+ character password. Choose **User** or **Administrator** before submitting; the two roles have different workspaces.

```bash
npm run build    # production build
npm run preview  # preview the production build
```

## Front-end technologies (and why)

| Technology | Why we used it |
| --- | --- |
| **React 19** | Component-based screens that match the A1 design system, with client-side state for mock queues, history, and notifications. |
| **Vite 6** | Fast local development and a simple production build. |
| **React Router 7** | Role-aware routes (`/login`, `/register`, `/user/*`, `/admin/*`) so navigation between screens is real, not a single page of tabs. |
| **lucide-react** | Consistent, lightweight icons that match the teal / coral palette from A1. |
| **Plain CSS** (no UI kit) | Keeps the look identical to the A1 mockups (DM Sans + Manrope, 7–8px radii, teal `#137c75`) without fighting a component library. |

The methodology from Assignment 1 did not change: we still designed screens first, then implemented them as a four-person split. Work is divided by screen so GitHub history can validate each member’s contribution.

## Screen ownership

| Person | GitHub | Screens / features |
| --- | --- | --- |
| 1 | [Parham-Ebrahimi](https://github.com/Parham-Ebrahimi) | Login, Registration, client-side auth validation, sidebar / top bar, shared CSS and components (`Brand`, `FormField`, `AppShell`) |
| 2 | [TheRealMufasa](https://github.com/TheRealMufasa) (Mustafa Ahmed) | User Dashboard, Join Queue, Queue Status, mock queue join / leave / simulate-next, Account Settings |
| 3 | [kevinsorts](https://github.com/kevinsorts) | Admin Dashboard, Service Management (create / edit / delete, open / close), service form validation |
| 4 | [wynetyme](https://github.com/wynetyme) | Queue Management (reorder / remove / serve next), History, in-app Notifications, service-form spec alignment (description, priority, 100-character name, expected duration), shared persisted mock data |

## Person 4 contribution notes (for the submission table)

**What was contributed**

- Queue Management: service selector, live visitor list, move up / down, remove (with confirm), serve-next simulation, recently-served strip, open / close from the same screen.
- History: `/user/history` with date, service, time in line, and outcome (Served / Left / Removed), plus filter chips and summary stats. Outcomes are written automatically.
- Notifications: working top-bar center (unread badge, mark read / mark all / clear) and dashboard summaries. Emitted on join, position change, almost-ready, served, left, admin serve / remove, and queue open / close.
- Service form brought in line with the A2 spec: required Description (max 500), Priority (low / medium / high), Service Name max 100 with remaining-character hint, Expected Duration 1–480 minutes, time picker for closing time.
- Shared `localStorage` data layer so a member who joins a queue appears on the administrator’s queue list, and “Serve next” moves that member’s position.

**Discussion notes**

Person 4 owned the leftover A2 screens (Queue Management, History, Notifications) and the remaining form-spec gaps on Service Management. The teammates’ screens were kept and refined so user and admin views share one mock source of truth. Regular commits were authored as `wynetyme`.

## Canvas submission document

Upload **only** this document to Canvas (do not upload the code):

- [docs/A2-QueueSmart-Submission.pdf](docs/A2-QueueSmart-Submission.pdf)
- [docs/A2-QueueSmart-Submission.docx](docs/A2-QueueSmart-Submission.docx) (same content)

It includes the GitHub link, methodology, technologies and responsibilities, labeled screenshots, and the team contribution table.

## Required screens

Labeled screenshots for the PDF live in [`docs/screenshots/`](docs/screenshots).

1. Login / Registration
2. User Dashboard
3. Join Queue
4. Queue Status
5. History
6. Admin Dashboard
7. Service Management
8. Queue Management
9. Notifications (in-app)

## Assignment 3

The Express API lives in `server/`. Person 1 added auth, Person 2 added services and wait-time estimates, Person 3 added queues and history. Person 4 (`wynetyme`) added notifications, the end-to-end tests, and coverage.

```bash
cd server
npm install
npm start          # http://127.0.0.1:4000/api
npm test
npm run test:coverage
```

From the repo root, `npm run dev` still serves the UI and proxies `/api` to that backend.

**Person 4 (this assignment)**

- `GET /api/users/:userId/notifications` plus mark-read / mark-all-read.
- Notices are created when someone joins a queue and when they reach the front (position 2, then position 1). Served / left / removed also write a notice.
- Frontend notification center reads the API instead of only `localStorage`.
- Workflow tests cover auth → services → wait time → join → notifications → serve → history.
- Integration notes: [`docs/INTEGRATION.md`](docs/INTEGRATION.md).

## Notes for later assignments

The UI is built so later assignments can swap the remaining `localStorage` helpers (`src/queueData.js` service cache) for a database without rewriting the screens.

## Assignment 4: Accounts and Profiles

Registration, login, profile updates, and password changes now use SQLite through the Express API. The account schema is in [`server/src/data/schema.sql`](server/src/data/schema.sql): `user_credentials.id` is the primary key, `user_credentials.email` is unique (case-insensitive), and `user_profiles.user_id` is both a primary key and a foreign key to the credentials row. Passwords are stored as bcrypt hashes, never as plain text. Profile data is read from the database on sign-in and when the workspace opens.

Use Node.js 24 or newer. From `server/`, run `npm install`, then `npm start`. The database is created at `server/data/queuesmart.sqlite` on first use; set `DATABASE_PATH` to use another location. Test runs use an in-memory database unless `DATABASE_PATH` is set. Run `npm run test:coverage` from `server/` for the coverage report. The SQLite database file is ignored by Git.

The new authenticated routes are `GET /api/auth/profile`, `PATCH /api/auth/profile`, and `POST /api/auth/change-password`. The remaining service, queue, history, and notification stores are still separate A3 work and are not part of this accounts change.
