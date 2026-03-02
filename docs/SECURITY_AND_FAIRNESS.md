# Security, Fairness, and Role-Based System

This document describes the security and fairness measures and the role-based access control (RBAC) for the online exam platform.

---

## 1. Exam Security

### 1.1 Server-based countdown timer
- The **timer is server-authoritative**. The client sends a heartbeat every **5 seconds** to `/api/exam/heartbeat` with the current client-side time remaining.
- The server computes `time_remaining` from `started_at` + exam `duration` + `extra_time_seconds` and returns it. The client syncs its display to this value.
- The exam **cannot be paused** by the student; closing the tab or pausing the timer does not extend time.

### 1.2 Heartbeat system
- **Interval:** 5 seconds (configurable in the exam start page’s `EnhancedSessionMonitor`).
- **Purpose:** Detect disconnects or app closure. The server and `session_security.last_verified` are updated on each successful heartbeat.
- **Failure:** After 3 consecutive heartbeat failures, the session is terminated and the student is redirected. A `heartbeat_fail` event is logged in `activity_logs` and can contribute to risk score.

### 1.3 Soft device binding
- **Device fingerprint** is stored when the student starts the exam (`session_security.device_fingerprint`).
- If the same exam is opened from another device (different fingerprint), the session can be taken over; the previous device is terminated and a `device_change` event is logged.
- **Risk score** on `exam_sessions.risk_score` is increased for device change, tab switch, fullscreen exit, and heartbeat failures. This allows teachers to flag suspicious behavior without blocking re-login on a new device (e.g. technical issues).

### 1.4 Tab switch / fullscreen exit detection
- **Tab switch:** When the page loses visibility (`document.visibilityState === "hidden"`), the client sends an activity log event `tab_switch` to `/api/exam/activity`.
- **Fullscreen exit:** If the exam requires fullscreen and the student exits fullscreen, a `fullscreen_exit` event is logged.
- These events are stored in `activity_logs` and contribute to the session’s risk score.

### 1.5 Auto-submit when time ends
- **Client:** When the timer (synced from server) reaches 0, the client auto-submits the exam.
- **Server:** The heartbeat API returns `expired: true` when server-calculated time is ≤ 0, so the client can trigger submit even if the local timer was off.
- **Cron:** Optional `/api/cron/auto-submit` can be called (e.g. by Vercel Cron) to mark in-progress sessions as submitted when their end time has passed (e.g. if the client never submitted). Set `CRON_SECRET` and call with `Authorization: Bearer <CRON_SECRET>`.

### 1.6 Activity logging
- All security-relevant student actions are logged in **`activity_logs`**:
  - `tab_switch`, `fullscreen_exit`, `device_change`, `heartbeat_fail`, `disconnect`, `reconnect`
- Each row has `session_id`, `student_id`, `exam_id`, `event_type`, `metadata`, `created_at`. Admins can view these in **Dashboard → System Logs → Activity logs**.

---

## 2. Role-based access control (RBAC)

### 2.1 Roles
- **Admin:** Full oversight. Can manage students, teachers, grades, subjects, sections; view all exams (Exam Oversight); view activity and audit logs.
- **Teacher:** Can create and manage own exams, view and correct results for own exams, assign exams to students, and use Live Monitoring for own exam sessions. Cannot access other teachers’ exams or admin-only data.
- **Student:** Can only take assigned exams (via exam code + student ID). No access to teacher or admin dashboards.

### 2.2 Implementation
- **Admin:** Authenticated via Supabase Auth; membership in `admin` table is checked (e.g. in dashboard layout and API routes). Admin-only APIs (`/api/admin/activity-logs`, `/api/admin/audit-logs`) verify the user is in `admin` before returning data.
- **Teacher:** Teacher actions are identified by cookie/session (e.g. `teacherData`). Live monitoring and exam APIs filter by `teacher_id` where applicable. Audit logs can record `actor_type: 'teacher'` and `actor_id` for accountability.
- **Student:** Exam access is validated by assignment (`assign_exams` or equivalent) and by exam code + student ID at login. The exam session is tied to `student_id` and `security_token`; heartbeat and activity APIs validate this token.

### 2.3 Audit logs
- **`audit_logs`** table stores actions by admins and teachers: `actor_type`, `actor_id`, `action`, `resource_type`, `resource_id`, `details`, `ip_address`, `created_at`.
- Use the helper `writeAuditLog()` from `lib/auditLog.ts` in API routes or server actions when performing sensitive operations (e.g. create teacher, delete student, force-submit exam). Admins can view these in **Dashboard → System Logs → Audit logs**.

---

## 3. Live monitoring (teacher)

- **Teacher dashboard → Live Monitoring** shows real-time sessions for that teacher’s exams.
- For each session: **status** (Active / Disconnected / Submitted), **time remaining**, **risk score**, and actions: add time (+5 / +10 min), force submit.
- **Active** = heartbeat received within the last ~25 seconds; **Disconnected** = no heartbeat in that window. **Flagged** = risk score > 0 or disconnected.
- Data is updated via Supabase Realtime (postgres_changes on `exam_sessions`) and optional manual refresh.

---

## 4. Admin oversight

- **Exam Oversight** (`/dashboard/exams`): Lists all exams across teachers (read-only) with a live session summary per exam (active / disconnected / flagged counts).
- **System Logs** (`/dashboard/logs`): Tabs for **Activity logs** (student exam events) and **Audit logs** (admin/teacher actions). Only admins can access these pages and the underlying APIs.

---

## 5. Electron secure exam environment

- **Fullscreen** enforced on exam pages; **DevTools** disabled in `webPreferences`.
- **Single instance:** Only one app instance; second launch focuses the first.
- **Content protection** to reduce screenshots.
- **Close event:** On window close during an exam, the main process sends `exam-window-closing` to the renderer (if a preload exposes it) so the app can attempt to log disconnect before exit.
- Power or network loss is handled by the web app (online/offline events and heartbeat); when the connection is restored, the client can continue if the session is still valid.

---

## 6. Database schema (relevant tables)

- **exam_sessions:** `time_remaining`, `last_activity_at`, `risk_score`, `extra_time_seconds`, `security_token`, `last_device_fingerprint`, `device_takeover_count`
- **session_security:** `device_fingerprint`, `last_verified`, `token`, `is_active`
- **activity_logs:** `session_id`, `student_id`, `exam_id`, `event_type`, `metadata`, `created_at`
- **audit_logs:** `actor_type`, `actor_id`, `action`, `resource_type`, `resource_id`, `details`, `ip_address`, `created_at`

Run `table.sql` for a full schema; use `table-migrations.sql` to add new tables/columns to an existing database.
