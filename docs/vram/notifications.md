# Response notifications

React Toastify handles application response notifications. One ToastProvider and
ToastContainer serve each app: `frontend-next/app/layout.tsx` mounts the provider
from `frontend-next/context/toastContext.tsx`; the legacy app mounts its provider
in `frontend/src/main.jsx`. Do not add a container to each form. The default
position is top-right and notifications survive client navigation.

## Shared notifications

```tsx
"use client";

import { useToast } from "@/context/toastContext";

const { handleToast } = useToast();
handleToast("Saved successfully.", "success");
handleToast("Could not save.", "error");
```

Use the snippet inside a Next.js client component. Legacy callers import from
`frontend/src/context/ToastContext.jsx` using the appropriate relative path.
The signature is
`handleToast(message, type, duration = 3000, ...callbacks)`. `danger` maps to
`error`. Callback functions execute immediately, not when a toast closes.
`formatToastMessage()` converts strings, arrays, and validation objects into text.
Keep field errors beside inputs as well as any summary notification.

## Per-component appearance

```jsx
import { toast as notify } from "react-toastify";

notify.success("Saved successfully.", {
  theme: "dark",
  style: { background: "#171a21", color: "#e7e6e1" },
  progressStyle: { background: "#3ecf8e", height: "3px" },
  autoClose: 3000,
});
```

Replace the original toast call for that response to avoid duplicates. Toastify
shows status icons by default; `icon: false` removes them. A gradient progress bar
is a countdown design, not an animated loading indicator. For asynchronous work,
use `toast.loading()` and update the same ID with `isLoading: false`, a status,
and `autoClose` after the request finishes.

Next.js login owns `notifyLogin()` in `frontend-next/app/login/login-form.tsx`;
legacy login keeps it in `frontend/src/pages/auth/Login.jsx`: compact charcoal background,
light text, mint success icon/bar, coral error icon/bar, and no close button.
Its explicit colors are necessary because the global container is outside the
login palette scope. Failed logins read the caught error, not an undefined response.
The legacy users form currently has its own blue-gray/RGB success override; other forms
can keep their shared defaults.

Legacy Profile uses the shared helper and normalizes backend errors, including Blob JSON.
Legacy GeneratedModulePage accepts `onToast`, otherwise uses the shared context or
`showToast()` fallback. A standalone app embedding it must mount a ToastContainer.

Response toasts are distinct from the unfinished backend Notifications module.
