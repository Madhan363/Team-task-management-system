# To-Do List

A React/Vite to-do app with an Express API and MongoDB storage. User passwords are bcrypt-hashed, login sessions use HTTP-only cookies, and every task query is scoped to the authenticated user.

## Run locally

1. Install MongoDB Community Server and start its Windows service, or create a MongoDB Atlas database and connection string.
2. Create `.env` from `.env.example` and configure the variables below. Public signup creates only the first Admin account when the submitted email matches `ADMIN_EMAIL` and no Admin exists. After bootstrap, an Admin creates additional accounts from the Admin Dashboard.
3. Install packages with `npm install`.
4. For development, run `npm run server` in one terminal, then `npm run dev` in another and open the Vite URL. Vite proxies `/api` requests to the backend.
5. For a single production server, run `npm run build`, then `npm start`. Open `http://localhost:4000/`; Express serves the built app and its API.
6. Check `http://localhost:4000/api/health` for API and database status.
7. Run `npm run test:api` while the API is running to verify password hashing, sessions, task ownership, team assignments, and acknowledgements. Run `npm run test:assistant` to verify assistant authentication, role-scoped task access, and chat-history ownership/operations.

## Features

- Public welcome page with a short animated walkthrough and links to account access.
- Sign up is reserved for creating the first Admin account; use the Admin Dashboard to create Admin, Team Leader, and Team Member IDs afterward. Log in with the username or email and password provided by your administrator.
- Login offers standard sign-in, separate Team Leader and Team Member entry pages, and a separate Admin Login. The Admin dashboard creates and manages user IDs, roles, departments, and task monitoring. Admins assign Team Leaders to departments; leaders create teams, add department members, assign individual or shared tasks, and track acknowledgement notifications. Members can view only tasks assigned to them, acknowledge receipt, update progress, and submit work for review.
- Edit your account name, username, email, and profile picture from the profile view.
- Password hashing and seven-day HTTP-only cookie sessions with logout.
- Transparent Employee Activity Time reports distinguish server-recorded active application time from total signed-in session duration. Admins can review all active accounts, Team Leaders only their department, and Team Members their own records.
- Create, edit, complete, delete, and clear tasks.
- Productivity dashboard with total, completed, pending, and overdue counts; completion percentage; today's hourly and seven-day charts; and a comparison with the previous week. Trends use completion history from current tasks; older completions without timestamps are not included.
- Task descriptions, categories, priority, due dates, and reminder times.
- A separate AI task assistant that turns a large goal into selectable, manageable tasks. Goals are sent to OpenAI; if the API quota is exhausted, built-in suggestions are used instead. Tasks are saved only when selected and added. OpenAI suggestions require a configured API key.
- The role-aware Smart Assistant supports Admin, Team Leader, Team Member, and Personal accounts. It uses authenticated, role-scoped task data; provides deterministic answers for task counts, statuses, deadlines, review queues, and workload; and labels rule-based fallback answers when the AI provider is not configured or unavailable. OpenAI credentials stay in the backend environment. Conversations are saved per user and can be created, cleared, and deleted from chat history. The assistant is read-only; task creation remains a separate explicit user action.
- The assistant chat renders Markdown (including GitHub-style tables) and includes suggested questions, copy-answer controls, task summaries, a typing state, multiline input, and responsive saved-chat history.
- Team Members have a separate Todo List menu for creating and managing personal tasks independently from Team Leader assignments.
- Smart task prioritization with recommended, deadline, and priority sorting, urgent-task highlighting, and a suggested next task.
- In-app reminder notices while the app is open, plus optional browser notifications.
- Dark/light task-page theme switch saved in this browser, with a matching ambient background illustration.
- Search, status filters, and per-user task storage.
- Imports tasks saved by the previous browser-only version when a new account is created.
- Collaborative User Story Management with department-scoped multi-member assignment and individual responsibilities, member-owned progress/status/notes, shared comments and links, activity history, Team Leader review/return workflow, overdue highlighting, and assignment/comment/review/deadline notifications.
- Collaborative Team Tasks: Team Leaders can assign one task to multiple members in their department, distribute responsibilities, and attach reference files. Assigned members share a persistent task discussion, update only their own contribution, and submit the team work with notes and supporting files. Team Leaders review submissions and must acknowledge them before a task is completed. Chat is persisted in MongoDB and refreshed while the workspace is open; no additional real-time package is required.
- Admin-only audit logs for account, department, and task workflow actions. Personal Todo List APIs keep Team Leader assignments separate and do not allow members to edit or complete assigned work outside the review workflow.
- Role-based Meeting Rooms: Admins invite Team Leaders to a leadership room, Team Leaders create rooms for members in their assigned department, and members can view rooms they were invited to. Schedule meetings in rooms, join with a Meet link, share announcements, record notes/decisions/blockers, and track follow-up tasks. Participant notifications and 15-minute meeting reminders are stored in the existing notification system.

Browser reminders require the app to be open. Enable notification permission from the signed-in task view to receive browser notifications while the app is open.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string, for example `mongodb://127.0.0.1:27017/todoapp` or an Atlas URI. |
| `JWT_SECRET` | Yes | Random signing secret of at least 32 characters. Keep it server-side. |
| `PORT` | No | Express port; defaults to `4000`. |
| `ACTIVITY_INACTIVITY_MS` | No | Inactivity cutoff for active-time estimates in milliseconds; defaults to `300000` (5 minutes), allowed range 10 seconds–60 minutes. |
| `ACTIVITY_PRESENCE_INTERVAL_MS` | No | In-app presence check interval in milliseconds; defaults to `120000` (2 minutes), allowed range 10 seconds–5 minutes. |
| `ADMIN_EMAIL` | For first Admin setup | Exact email allowed to create the first Admin through public signup. |
| `OPENAI_API_KEY` | No | Server-side API key enabling contextual AI assistant answers and goal suggestions. Without it, task questions use the rule-based assistant. |
| `OPENAI_MODEL` | No | Model name used by the backend; defaults to `gpt-4o-mini`. |
| `GOOGLE_CLIENT_ID` | No | Server-side Google OAuth client ID used for Calendar event and Meet link creation. |
| `GOOGLE_CLIENT_SECRET` | No | Server-side Google OAuth client secret. Never use a `VITE_` prefix. |
| `GOOGLE_REFRESH_TOKEN` | No | Server-side refresh token with Calendar event access. Keep it private and rotate it if exposed. |
| `GOOGLE_CALENDAR_ID` | No | Calendar to manage; defaults to `primary`. |

The application connects to MongoDB using Mongoose. The existing `Task`, `User`, `Department`, `TaskResponse`, `TaskHistory`, and notification models are reused; audit events are stored separately in the `AuditLog` collection. No database is bundled with the application.

## Google Calendar and Meet setup (optional)

Without Google OAuth configured, Admins and Team Leaders can schedule meetings by pasting an existing HTTPS URL hosted on `meet.google.com`. To create Calendar events and generate Meet links automatically:

1. Create or select a project in the [Google Cloud Console](https://console.cloud.google.com/), enable the **Google Calendar API**, and configure its OAuth consent screen.
2. Create an OAuth client and authorize it for the Calendar events scope `https://www.googleapis.com/auth/calendar.events`. For a straightforward one-time refresh-token setup, use the Google OAuth 2.0 Playground with your own OAuth client credentials, set the scope above, authorize the intended organizer account, and exchange the authorization code for tokens.
3. Copy the resulting refresh token to the backend environment as `GOOGLE_REFRESH_TOKEN`; set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and optionally `GOOGLE_CALENDAR_ID` (usually `primary`). Restart the backend after setting environment variables.
4. Keep all four values in the hosting provider's server-side secret/environment settings (or the untracked local `.env`). Do not put them in Vite variables, browser storage, source control, or frontend build configuration.

The backend creates Calendar invitations for the selected participants and requests a Google Meet conference when no Meet URL is supplied. Google account consent, Calendar API availability, account policy, and a valid organizer refresh token are required. If OAuth is not configured, manual Google Meet URLs remain supported.

## API overview

All API routes use the `/api` prefix. Login state is carried in an HTTP-only `todo_session` cookie. Except for health, login, and first-account signup, routes require an authenticated session. Authorization is additionally enforced by role and task ownership.

| Route | Purpose | Access |
| --- | --- | --- |
| `GET /api/health` | API and MongoDB health | Public |
| `POST /api/auth/login`, `POST /api/auth/signup`, `POST /api/auth/logout` | Login, first Admin signup, and logout | Public/session |
| `GET /api/dashboard/admin` | Admin analytics | Admin |
| `GET /api/dashboard/team-leader` | Department workload and task summary | Team Leader/Admin |
| `GET /api/dashboard/team-member` | Current member's task summary | Authenticated user |
| `GET /api/tasks/personal` | Personal Todo List tasks, excluding Leader-assigned tasks | Authenticated user |
| `GET /api/tasks/my-tasks` | Tasks assigned to the current member | Authenticated user |
| `POST /api/tasks`, `PATCH /api/tasks/:id/status` | Create personal/assigned task and update workflow status | Authenticated; role/resource checks |
| `GET /api/tasks/team` | Department-scoped tasks, including shared tasks | Team Leader/Admin |
| `GET, POST /api/tasks/:id/chat` | Read or post persistent shared-task messages | Authorized task collaborators |
| `PATCH /api/tasks/:id/contribution` | Update the current member's own work distribution contribution | Assigned Team Member |
| `PATCH /api/tasks/:id/contributions/:memberId` | Update an assigned member's responsibility and work description | Team Leader/Admin with task access |
| `POST /api/tasks/:id/team-submissions` | Submit shared work, notes, and up to 1 MB of PDF/PNG/JPEG/TXT files | Assigned Team Member |
| `PATCH /api/tasks/:id/review` | Approve or request changes on a submission | Team Leader/Admin with task access |
| `POST /api/tasks/:id/responses`, `GET /api/tasks/:id/history` | Task comments and activity history | Authenticated with task access |
| `GET /api/projects`, `GET /api/projects/:projectId` | List published projects and authorized task details | Admin, Team Leader, or department Team Member; members see assigned tasks |
| `GET /api/projects/import/members` | List active members eligible for project assignment | Team Leader; own department only |
| `POST /api/projects/import/preview` | Parse an `.xlsx` workbook and persist a private import draft | Team Leader; 5 MB maximum |
| `GET /api/projects/import/:draftId` | Resume an owned draft | Creating Team Leader |
| `PUT /api/projects/import/:draftId/rows` | Save corrected preview rows and revalidate | Creating Team Leader |
| `PUT /api/projects/import/:draftId/assignments` | Persist task-to-member responsibilities | Creating Team Leader; server validates department/role |
| `POST /api/projects/import/:draftId/publish` | Publish all grouped projects/tasks and notify assignees | Creating Team Leader |
| `DELETE /api/projects/import/:draftId` | Cancel and remove a private import draft | Creating Team Leader |
| `GET /api/notifications` | Current user's notifications | Authenticated user |
| `POST /api/activity/session` | Ensure the authenticated login has an activity session (also upgrades existing cookies) | Authenticated user |
| `POST /api/activity/activity`, `POST /api/activity/presence` | Record server-timestamped in-app interaction or app presence | Authenticated user; current session only |
| `GET /api/activity/report?period=today\|week\|month` | Active time, session duration, daily totals, and session history | Admin (all), Team Leader (own department), Team Member/Personal (self) |
| `GET /api/meetings`, `GET /api/meetings/rooms` | Meetings and rooms visible to the current account | Authenticated; participant/room scoped |
| `POST /api/meetings/rooms`, `PATCH /api/meetings/rooms/:id` | Create leadership/team rooms and manage invitees | Admin or owning Team Leader |

Existing Task documents remain compatible; Mongoose defaults provide empty assignee, contribution, chat, and submission fields, so no destructive database migration is required. Uploaded task reference and submission files are stored as validated data URLs in MongoDB with a 1 MB combined upload limit per operation. Shared-task messages are persisted in the task document, and the workspace polls for new messages every five seconds.

## Team Collaboration and Excel project import

Team Leaders open **Team Collaboration** from the sidebar. Excel workbooks must contain `Project Name`, `Task Title`, and `Priority` headers; project/task descriptions and start/due dates are optional. Rows with the same project name are grouped together. The page provides editable validation preview, per-task department member assignments, saved drafts, final confirmation, and publication. Formula cells are never calculated or imported. Drafts expire after 24 hours. Published projects use the existing Task, contribution, task history, chat, submission, review, audit, and notification workflows. A project is marked Completed only when every task reaches the existing Team Leader-approved `completed` state.

Install the parser with the project dependencies (`npm install`); ExcelJS is included in `package.json`. No new environment variables are required. Mongoose creates the `Project` and `ProjectImportDraft` collections/indexes automatically. Staging tasks are hidden from ordinary task queries until project publication completes. Failed publication attempts remove staged records; no destructive database migration is required.

The User Stories page, navigation, client API, and server endpoints have been removed. Existing UserStory documents and historical records are retained in MongoDB and are not shown in the application; this change does not delete existing data.

## Employee activity time tracking

On successful login, the server creates an `ActivitySession` with server-side login time and a seven-day expiry. The authenticated browser records only a timestamped application interaction (pointer, keyboard interaction, scroll, or touch) and sends a separate presence ping while the app remains open. It does not send key values or capture screenshots, and it does not monitor activity outside the application. Active intervals are calculated by the server, capped at the configured inactivity threshold, and serialized through one per-user activity state so multiple tabs/devices cannot double-count overlapping intervals. Session duration is signed-in wall-clock time; activity time is a separate estimate and is not a productivity measure.

MongoDB creates the `ActivitySession`, `ActivityState`, and `ActivityEvent` collections and their indexes through Mongoose; there is no destructive migration or new package requirement. Explicit logout and JWT expiry are stored as session end events. If the browser or network disappears before logout, the report marks the end as estimated from the last in-app presence; no client timestamp is trusted. Reporting uses UTC day boundaries. Admins can review all active accounts, Team Leaders are restricted to their authorized department, and Team Members/Personal accounts can only retrieve their own activity.

Run `npm run server` and `npm run dev` in separate terminals, then sign in and open **Activity Time** in the sidebar. Run `npm run build` for frontend validation and `npm run test:api` with MongoDB and the API available for authentication/API regression checks.

## Collaborative Team Task workflow

Team Leaders create a shared task by selecting at least two active Team Members in their department and optionally entering each member's responsibility. Members open the same task from My Assigned Tasks to update only their own contribution, exchange persistent chat messages, and submit final notes and files. If contributions remain unfinished, the submitter must confirm before submission. The Team Leader can request changes or acknowledge the submission; only acknowledgement marks the task Completed. `npm run test:api` exercises assignment scope, member isolation, chat access, submissions, change requests, and final approval.

## Collaborative User Story workflow

Run `npm run server` and `npm run dev` in separate terminals. Use `npm run build` for frontend validation and `npm run test:api` with the API and configured MongoDB available for authentication/API regression checks.
| `POST /api/meetings/rooms/:id/announcements` | Share a room announcement | Admin or owning Team Leader |
| `POST /api/meetings`, `PATCH /api/meetings/:id` | Schedule or update a meeting | Admin or owning Team Leader |
| `PATCH /api/meetings/:id/cancel`, `DELETE /api/meetings/:id` | Cancel or delete a meeting | Admin or owning Team Leader |
| `POST /api/meetings/:id/notes`, `POST /api/meetings/:id/follow-ups` | Record meeting notes and follow-up tasks | Meeting/room participants |
| `POST /api/assistant/team-member` | Contextual task Q&A; only the member's assigned tasks are queried | Team Member |
| `GET, POST /api/assistant/conversations` | List or create the authenticated user's chat history | Authenticated user |
| `GET, DELETE /api/assistant/conversations/:id` | Read or delete an owned conversation | Conversation owner |
| `DELETE /api/assistant/conversations/:id/messages` | Clear messages in an owned conversation | Conversation owner |
| `POST /api/assistant/chat` | Role-scoped, read-only assistant response using task records | Authenticated user; rate-limited |
| `GET /api/audit-logs` | Filtered, paginated audit events | Admin |
| `/api/users`, `/api/departments` | Account and department management | Admin |

Legacy single-member task submissions accept validated PDFs stored by the application (maximum 1 MB). Shared-task submissions support validated PDF, PNG, JPEG, and plain-text files with a combined 1 MB limit. The legacy Team Member assistant extracts text only from stored PDFs and never fetches arbitrary attachment URLs. Do not put AI keys or session secrets in frontend variables.
