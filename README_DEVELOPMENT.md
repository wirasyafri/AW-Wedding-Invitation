# Developer Documentation & Architecture Guide

This document describes the architectural layout, database schemas, security configurations, API routes, and interactive animation subsystems implemented for the AW Wedding Invitation app.

---

## 1. Supabase Database Schema

### Settings Table
We extended the existing `settings` table to accommodate camera configurations:
* `camera_delete_limit` (`INTEGER`, default `5`): Maximum deletions allowed per guest to recover photo slots.
* `camera_allow_delete_photo` (`BOOLEAN`, default `TRUE`): Checkbox toggle to enable or disable the guest photo deletion feature entirely.

### Camera Deletions Table
Created the `camera_deletions` table to track photo deletions on a per-guest basis.
```sql
CREATE TABLE IF NOT EXISTS camera_deletions (
  id BIGSERIAL PRIMARY KEY,
  guest_id TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Security & Row Level Security (RLS)
* **RLS is enabled** on the `camera_deletions` table with **no public policies**.
* By locking down public write access, clients using the public anon key cannot bypass checks to delete logging rows. 
* All database writes/updates are executed server-side in API routes using the privileged Supabase `service_role` client which automatically bypasses RLS.

---

## 2. Supabase Storage Buckets & Policies

### Active Buckets:
1. `disposable-camera`: Holds photos taken by wedding guests.
2. `photos`: Holds groom/bride profile images and background assets.

### Policy Recommendation:
* Both buckets must be set to **Public** so that images can be fetched and rendered in browser templates.
* **No write/edit (INSERT, UPDATE, DELETE) policies should be created for the public.**
* All file uploads and deletions are performed through the backend API routes using the `service_role` client. Keeping policies empty prevents malicious users from directly altering, overwriting, or filling up storage buckets using browser console commands.

---

## 3. Server API Routes (`/src/pages/api/*`)

### `GET /api/camera?guest=NAME`
* Fetches the list of photos taken by the specified guest.
* Queries `camera_deletions` to return `{ photos, deletionCount }` JSON.

### `POST /api/camera`
* Expects `FormData` containing the `guest` name and `photos` file blob.
* Validates that the guest has not exceeded their photo limit.
* Uploads the JPEG image to the `disposable-camera` bucket using a randomized timestamp file name, retrieves the public URL, and inserts a row in the `camera_photos` table.

### `DELETE /api/camera?id=PHOTO_ID&guest=GUEST_NAME`
* Authenticates the request (either via Admin Password or Guest Name validation).
* Checks if the photo belongs to the requesting guest.
* Verifies if guest deletion is allowed (`camera_allow_delete_photo`) and if the guest is within the deletion limit.
* Deletes the physical photo file from Supabase Storage, removes the record from `camera_photos`, and records the deletion in `camera_deletions` for logs.

### `POST /api/upload`
* Admin endpoint used to upload hero backgrounds and couple profile photos.
* Requires the correct `ADMIN_PASSWORD` header/form parameter.
* Deletes old assets to conserve storage and uploads the new file to the `photos` bucket.

### `POST /api/save-settings`
* Saves general invitation parameters alongside the new `camera_delete_limit` and `camera_allow_delete_photo` configurations.
* Requires `ADMIN_PASSWORD` validation.

---

## 4. Frontend Subsystems & Interactive Polish

### Disposable Camera UI (`/src/pages/camera.astro`)
* **Asynchronous Background Uploads**: Captures are rendered instantly as a blurred preview placeholder with a loading spinner. The actual upload executes in the background, freeing the camera shutter after an **800ms throttle** so guests can take shots in quick succession.
* **Polaroid Preview Modal**: Clicking any polaroid image in the gallery opens a full-screen blurred-backdrop modal (`max-w-lg`) displaying the photo inside a large polaroid frame.
* **Settings Integration**: Dynamically hides deletion buttons and counters if the administrator disables the deletion feature in the settings panel.

### Clipboard Copy Animation (`/src/components/Gift.astro`)
* When copying account numbers in the gift section, the button scales down (`scale-95`), transitions to an emerald success background (`bg-emerald-500`), and changes its icon/text to a checkmark with **"Tersalin!"** for 2 seconds before reverting back.

### Custom Canvas Animations

#### Gold Leaves Overlay (`/src/pages/index.astro`)
* A full-screen canvas physics simulation (`z-[99]`, pointer events disabled) that draws and glides gold/champagne leaves/petals falling diagonally.

#### Cover Pets Animation (`/src/components/Cover.astro`)
* An interactive canvas overlay (`z-20`, pointer events disabled) running on the invitation cover page:
  * **Winter White Hamsters**: Roam along the bottom edge, walking, running, and stopping to sniff.
  * **Sugar Gliders**: Stretched membrane gliders (complete with pink ears, paws, stripes, and tail tips matching real photos) glide diagonally down across the screen on top of the invitation card.
  * The animation loop automatically stops (`coverActive = false`) as soon as the user opens the invitation, freeing browser memory.
