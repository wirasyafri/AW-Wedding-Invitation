# AW Wedding Invitation App Developer Guidelines & Context

This file serves as workspace instructions for Antigravity (AI coding assistant) when working on the AW Wedding Invitation repository. Always read and adhere to these guidelines during feature requests, refactoring, or database modifications.

---

## 1. Project Context & Stack
* **Framework**: Astro (running Vercel adapter SSR server mode).
* **Database & Storage**: Supabase (PostgreSQL tables, storage buckets).
* **Styling**: Vanilla Tailwind CSS.

---

## 2. Security & RLS Rules
* **Privileged Actions**: All database modifications (wishes insertion, settings saving, logging deletions) and storage operations (photo uploads, photo deletions) must run **server-side** inside Astro API routes (`/src/pages/api/*`) using the privileged `supabase.server.ts` or `supabase.server` client.
* **Service Role Key**: The server client uses the `SUPABASE_SERVICE_ROLE_KEY` to automatically bypass Row Level Security (RLS) policies.
* **RLS Enforcement**:
  * Tables like `camera_deletions` must have **RLS enabled** with **no public policies** to prevent direct manipulation or abuse from browser client anon keys.
  * Storage buckets (`disposable-camera` and `photos`) must have **no write/update public policies** to prevent direct upload/overwrite injection bypasses from browsers.
* **Validation**: Any user/guest actions (like photo deletions) must validate ownership (`photoRecord.guest_id === guest`) and limits (`deletionCount < deleteLimit`) server-side.

---

## 3. Storage Bucket Configuration
* `disposable-camera`: Guest photos.
* `photos`: Groom/bride assets and hero backgrounds.
* Both must remain **Public** so their assets can be read directly by client HTML pages.

---

## 4. Key Endpoints & APIs
* `GET /api/camera?guest=NAME`: Loads guest photos and logs deletion count.
* `POST /api/camera`: Non-blocking guest photo upload.
* `DELETE /api/camera?id=ID&guest=NAME`: Guest/admin deletion with safety verification checks.
* `POST /api/upload`: Authenticated admin asset upload.
* `POST /api/save-settings`: Authenticated admin settings updates.
* `GET /api/admin-stats?adminPass=PASS`: Fetches storage bucket metrics, database row counts, active URLs list, deletions history, wishes RSVP counts, and settings.
* `POST /api/admin-storage-action`: Password-secured endpoint to delete orphan files from storage (`action: 'delete-file'`) or wipe audit logs (`action: 'clear-deletions-log'`).

---

## 5. UI Polish & Animation Subsystems
* **Camera Capture Flow**: Capture is non-blocking. Renders a blurred local URL placeholder in the gallery immediately and processes upload in the background. The Shutter button is throttled for 800ms.
* **Preview Modal**: Triggers by clicking gallery images, displaying a large polaroid mockup frame (`max-w-lg`).
* **Copy Buttons**: Copying bank accounts triggers a temporary visual success state (scaled down, green background, wiggling checkmark icon) for 2 seconds.
* **Canvas Animations**:
  * `falling-leaves` overlay canvas on `index.astro` (falling gold leaves).
  * `cover-pets-canvas` overlay on `Cover.astro` (winter white hamsters roaming at the bottom, sugar gliders with pink paws/ears and tail tips gliding across the card). The loop is stopped using `coverActive = false` when Cover is dismissed.

---

## 6. Moderator Panel & Storage Analysis Dashboard
* **Penyimpanan & Kuota Tab**: An admin dashboard view inside `/admin` to monitor Supabase resources. Displays resource progress bars (vs 1GB storage limit and 5k DB rows reference) and an RSVP segmented bar chart (Attending/Green, Not Attending/Red, Tentative/Yellow).
* **Orphan File Detection**: Automatically flags files in storage that have no active records in the database (`camera_photos`, `guest_voices`) or settings (`groom_photo`, etc.) as `[Orphan]`. Large files are flagged with `[>3MB]`.
* **Inline Previews & Cleanup**: Provides inline audio playback trigger cards for voice files, links to view assets, and delete buttons to wipe orphan files permanently from storage.
* **Safety Audit Logs**: Renders safety activity log records of guest deleted photos (`camera_deletions`) with an option to wipe the logs safely.
