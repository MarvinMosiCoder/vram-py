import type { SelectOption } from "@/types/modules";

// Response shapes of MenusController (backend/app/modules/admin/menus_module.py).

// _roles_of(): a menu's role assignment from the adm_menus_roles pivot.
// Selections made in the form carry the option's value as the id.
export type MenuRole = { id: SelectOption["value"]; name: string };

// _serialize(): active top-level rows carry one level of `children`;
// children and inactive rows are serialized without the key. A card appended
// from an add response has no `roles` until the page is reloaded.
export type Menu = {
  id: number;
  name: string | null;
  type: string | null;
  path: string | null;
  slug: string | null;
  icon: string | null;
  sorting: number | null;
  is_active: number | null;
  is_dashboard: number | null;
  roles?: MenuRole[];
  children?: Menu[];
};

// GET /menus (get_index). The page takes its role options from
// GET /menus/roles instead of `roles` here.
export type MenusIndexResponse = {
  page_title: string;
  roles: SelectOption[];
  menus: Menu[];
  inactive_menus: Menu[];
};

// POST /menus/add and /menus/update return the ORM row encoded by FastAPI,
// not _serialize(): no `roles` or `children`.
export type MenuRow = {
  id: number;
  name: string | null;
  type: string | null;
  path: string | null;
  slug: string | null;
  color: string | null;
  icon: string | null;
  parent_id: number | null;
  is_active: number | null;
  is_dashboard: number | null;
  id_adm_role: number | null;
  sorting: number | null;
  created_at: string | null;
  updated_at: string | null;
};

// post_add refreshes the row after commit, so every column is present.
export type MenuAddResponse = { message: string; status: string; menu: MenuRow };

// post_update does not refresh the row after commit; FastAPI encodes the
// expired instance as `{}`, so the page's merge by id currently matches nothing.
export type MenuUpdateResponse = { message: string; status: string; menu: Partial<MenuRow> };

// POST /menus/move (post_move).
export type MenuMoveResponse = { message: string; status: string };

// Fields shared by the Add menu form and the edit modal. The edit draft does
// not copy the stored slug, so `slug` exists only once the input is changed.
export type MenuFormValues = {
  name: string;
  path: string;
  icon: string;
  roles: MenuRole[];
  type: string;
  slug?: string;
  is_active: number | "";
};

export type AddMenuForm = MenuFormValues & { slug: string };

export type EditMenuForm = MenuFormValues & {
  id: number | "";
  is_dashboard: number | "";
};

export type FieldErrors = Record<string, string>;

// dragFrom/dragging: the source group and index, plus the drag-start X used
// to measure deliberate horizontal movement.
export type DragSource = { parentId: number | null; index: number; clientX: number };

export type DropTarget = { key: string; parentId: number | null; index: number };
