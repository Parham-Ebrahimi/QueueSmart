# Assignment 3 integration notes

Notes from wiring the frontend to the Person 1–3 APIs and adding the notification endpoints. The backend keeps everything in memory, so a restart clears accounts, services, queues, history, and notifications.

## What is wired

| Screen / action | API |
| --- | --- |
| Register / login | `POST /api/auth/register`, `POST /api/auth/login` |
| Service list, create, edit, delete | `GET/POST/PUT/DELETE /api/services` |
| Wait estimate | `GET /api/queues/:id/wait-time` |
| Join / leave / view queue | `POST .../join`, `POST .../leave`, `GET /api/queues/:serviceId` |
| Serve next, remove, reorder | admin queue routes |
| History | `GET /api/users/:userId/history` |
| Notifications | `GET /api/users/:userId/notifications` |

The Vite dev server proxies `/api` to `http://127.0.0.1:4000`. Both `npm run dev` (repo root) and `npm start` (in `server/`) need to be running.

## Notification behavior

The server writes a notice when a member joins a queue and when they reach position 2 (“Almost your turn”) or position 1 (“You’re next!”). Each of those front-of-line notices is stored once per visit so polling does not spam the same message. Ending a visit (served, left, removed) also writes a notice. Registered administrators get a “new visitor” notice on join.

`POST /api/notifications` was not added. Notices are created by queue actions. The UI marks them read with:

- `POST /api/users/:userId/notifications/:id/read`
- `POST /api/users/:userId/notifications/read-all`

Service create / edit / open / close notices still stay in the browser. Those are admin workspace events, not queue events.

## Issues we hit

1. **Server restart wipes state.** After a restart the frontend already drops a queue entry that returns 404. History and notifications also start empty. Sign-in tokens from before the restart are still valid, but the user record is gone, so joining again works with the token even though `/api/auth/login` would fail until they register again.

2. **One queue at a time.** A second join returns `ALREADY_IN_QUEUE` (409). The join screen already blocks this; the error still shows if the local ticket is out of date.

3. **Administrators cannot join.** Join and leave are user-only (`403`). That matches the A3 split. Admins manage the line from Queue Management.

4. **Wait time is `(position - 1) * expectedDuration`.** Position 1 is 0 minutes. The Join Queue cards use the same formula from the live queue length.

5. **Same-browser admin + user is no longer enough for join notices.** In A2, join wrote into `localStorage` so an admin tab on the same machine saw it. Join notices now live on the server, keyed by user id. An admin only sees “new visitor” if that admin account was registered (so it exists in the user store).

6. **Malformed IDs use the shared validation error.** Spaces or symbols in `:userId` / `:serviceId` return `400` with `details`, not `404`. The frontend always sends ids it got from the API.

7. **No email or SMS.** Notices are JSON for the in-app center. They are also printed to the server log outside of tests.

## Running tests

```bash
cd server
npm test
npm run test:coverage
```

Coverage is set to stay at or above 70% (lines, statements, functions, branches). The HTML report is written to `server/coverage/`.
