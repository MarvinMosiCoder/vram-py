# Profile and navbar

The profile editor and the navbar avatar are ported to `frontend-next/`:
`components/users/Profile.tsx` is served at `/profile` by
`app/(admin)/profile/page.tsx`, and legacy `frontend/src/pages/modules/users/Profile.jsx`
remains. The Next.js page reads the user from `useAuth()` rather than props, gets
its navbar title from the URL, and displays `/me`'s `id` and `role` where the React
page read `user_id` and `privilege_name`, which `/me` does not return. Built-in
avatars are copied to `frontend-next/public/images/profile-avatars/`. Saved images
come from the local snapshot described in [operations](operations.md#nextjs-profile-images),
so an image uploaded through Next.js does not display there until the snapshot is
refreshed. The backend still stores
images under the `frontend/public/` paths below; preserve those directories.
See [migration status](frontend.md#migration-status).

Open Profile from the navbar account dropdown or visit `/profile`.

| Process | Request | Result |
| --- | --- | --- |
| Load history | `GET /profiles` | Current user's stored images |
| Upload image | `POST /save-edit-image`, multipart `profile_image` | Validates and stores an image; returns message/status/file_name |
| Choose built-in avatar | `POST /save-profile-avatar`, `{avatar: key}` | Copies an allowlisted avatar into user profile storage |
| Apply history image | `POST /update-profile`, `{profile_id, action: "update"}` | Activates the selected image |
| Delete history image | Same endpoint, action `delete` | Removes the owned image/record |
| Download image | Same endpoint, action `download` | Returns a file or JSON warning |

Uploads accept JPG/JPEG, PNG, WebP, and AVIF up to 5 MB. Built-in options live
under `frontend/public/images/profile-avatars/`; saved images live under
`frontend/public/images/profile/`. Unlike current Laravel, this port uses physical
copies for built-in avatars, not `builtin:<key>` sentinels.

Selecting a candidate should stage it; an explicit save/apply action persists it.
Successful updates set the shared profile context and refresh history without
reloading the browser. AppNavbar passes the active filename to both shared Avatar
instances. Missing/broken images render initials. An empty filename clears the
local avatar. Deleting the displayed image clears it locally.

Profile responses use the global React Toastify helper. Errors are read from
`detail`, `errors`, or `message`, including JSON contained in a Blob. The download
handler checks JSON content before creating a file link, reports warnings as
toasts, and releases the temporary object URL after starting a real download.

Owners: `backend/app/api/admin/profile.py`,
`frontend/src/pages/modules/users/Profile.jsx`, `context/ThemeContext.jsx`,
`layout/AppNavbar.jsx`, and `components/avatar/Avatar.jsx` under the frontend source.
