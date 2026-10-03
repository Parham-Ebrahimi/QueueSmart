# QueueSmart

QueueSmart is a front-end demo for a campus queue-management app. Members join a service queue and watch their place in line. Administrators create services, open or close queues, reorder or remove visitors, and serve the next person.

This repository is the Assignment 2 (UI / UX and front-end) submission. There is no backend. All data is mocked and stored in the browser (`localStorage`).

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Sign in or register with any valid email and an 8+ character password. Choose **User** or **Administrator** before submitting — the two roles have different workspaces.

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

## Notes for later assignments

The UI is built so Assignment 3 can replace the `localStorage` helpers in `src/queueData.js`, `src/notifications.js`, and `src/history.js` with API calls without rewriting the screens.
