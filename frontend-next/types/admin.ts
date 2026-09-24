export type SidebarMenu = {
  id: number;
  name: string;
  path?: string | null;
  slug?: string | null;
  icon?: string | null;
  type?: string | null;
  children?: SidebarMenu[];
};

export type AdminNotification = {
  id: number;
  content?: string | null;
  type?: string | null;
  is_read: boolean | number;
  created_at?: string | null;
};
