type LoginResponse = {
  access_token: string;
  token_type: string;
};

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const response = await fetch("http://localhost:8080/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      username: email,
      password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Login failed. Please check your credentials."
    );
  }

  return data;
}

export type CurrentUser = {
  id: number;
  email: string;
  name?: string | null;
  theme_color?: string | null;
  role?: string | null;
  role_id?: number | null;
  is_superadmin?: boolean;
  profile?: string | null;
};

export type Announcement = {
  id: number;
  title?: string | null;
  message?: string | null;
  content?: string | null;
  created_at?: string | null;
};

export type PasswordPolicy = {
  must_change: boolean;
  is_default_password: boolean;
  can_waive: boolean;
  waivers_used: number;
  max_waivers: number;
};

export async function getAnnouncements(token: string): Promise<Announcement[]> {
  const response = await fetch("http://localhost:8080/announcements/unread", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Unable to load announcements.");
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function getPasswordPolicy(token: string): Promise<PasswordPolicy> {
  const response = await fetch("http://localhost:8080/password-policy", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Unable to load password policy.");
  return response.json();
}

export async function getCurrentUser(
  token: string
): Promise<CurrentUser> {
  const response = await fetch("http://localhost:8080/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Unable to load your account."
    );
  }

  return data;
}

export async function logout(token: string): Promise<void> {
  const response = await fetch("http://localhost:8080/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // An expired or invalid token already means this session has ended.
  if (!response.ok && response.status !== 401) {
    throw new Error("Logout failed. Please try again.");
  }
}
