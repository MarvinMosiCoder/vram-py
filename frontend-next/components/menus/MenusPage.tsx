"use client";

import { Fragment, useEffect, useState, useRef, type DragEvent, type FormEvent } from "react";
import axios from "axios";
import api from "@/lib/http";
import { fieldErrors } from "@/lib/api-errors";
import ContentPanel from "@/components/panel/ContentPanel";
import { useToast } from "@/context/toastContext";
import Modal from "@/components/modal/Modal";
import type { SelectOption } from "@/types/modules";
import MenuCard, { type DragProps, type DropProps } from "./MenuCard";
import MenuFormFields, { EMPTY_MENU_FORM } from "./MenuFormFields";
import type {
  AddMenuForm,
  DragSource,
  DropTarget,
  EditMenuForm,
  FieldErrors,
  Menu,
  MenuAddResponse,
  MenuMoveResponse,
  MenusIndexResponse,
  MenuUpdateResponse,
} from "./types";

// FastAPI puts HTTPException messages (a string, or an object for field
// errors) in `detail`.
function errorDetail(error: unknown): unknown {
  return axios.isAxiosError(error) ? error.response?.data?.detail : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Replaces legacy ModuleRoute, which passed modulePath/action/args; this page
// only needs the module path.
export default function MenusPage({ modulePath }: { modulePath: string }) {
  const [data, setData] = useState<MenusIndexResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [inActiveMenus, setInActiveMenus] = useState<Menu[]>([]);
  const dragFrom = useRef<DragSource | null>(null);
  const savePending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<DragSource | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const { handleToast } = useToast();
  const [addForm, setAddForm] = useState<AddMenuForm>(() => ({ ...EMPTY_MENU_FORM }));
  const [addErrors, setAddErrors] = useState<FieldErrors>({});
  const [editForm, setEditForm] = useState<EditMenuForm | null>(null);
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [editSaving, setEditSaving] = useState(false);
  const [roles, setRoles] = useState<SelectOption[]>([]);

  const saveMove = async (menuId: number, parentId: number | null, ordered: Menu[], previous: Menu[]) => {
    savePending.current = true;
    setSaving(true);

    try {
      await api.post<MenuMoveResponse>(`/${modulePath}/move`, {
        menu_id: menuId,
        parent_id: parentId,
        ids: ordered.map((menu) => menu.id),
      }, { timeout: 15000 });

      handleToast("Menu moved.", "success");
    } catch (error) {
      if (axios.isAxiosError(error) && (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT")) {
        try {
          const response = await api.get<MenusIndexResponse>(`/${modulePath}`, { timeout: 10000 });
          setMenus(response.data.menus);
          setInActiveMenus(response.data.inactive_menus);
          handleToast("The save timed out. Menu order was refreshed; you can drag again.", "warning");
        } catch {
          setError("The menu server is not responding. Refresh this page once it is available.");
        }
        return;
      }
      setMenus(previous);
      // Known limitation, kept from the React page: the active rollback
      // snapshot also replaces the inactive list until reload.
      setInActiveMenus(previous);
      const detail = errorDetail(error);
      handleToast(
        typeof detail === "string"
          ? detail
          : "Could not move the menu.",
        "error"
      );
    } finally {
      savePending.current = false;
      setSaving(false);
    }
  };

  const openEdit = (menu: Menu) => {
    if (savePending.current || editSaving) return;
    setEditErrors({});
    // The stored slug is not copied, as in the React page.
    setEditForm({
      id: menu.id ?? "",
      name: menu.name ?? "",
      path: menu.path ?? "",
      icon: menu.icon ?? "",
      roles: menu.roles ?? [],
      type: menu.type ?? "",
      is_active: menu.is_active ?? "",
      is_dashboard: menu.is_dashboard ?? "",
    });
  };

  const saveAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!addForm) return;

    setLoading(true);
    setAddErrors({});

    try {
      const response = await api.post<MenuAddResponse>(
        `/${modulePath}/add`,
        addForm,
        { timeout: 15000 }
      );

      const addedMenu = response.data.menu;

      // The saved row has no roles or children; both refresh on reload.
      setMenus((current) => [
        ...current,
        {
          ...addedMenu,
          children: [],
        },
      ]);

      setAddForm({ ...EMPTY_MENU_FORM });
      setAddErrors({});

      handleToast("Menu added.", "success");
    } catch (error) {
      const detail = errorDetail(error);

      setAddErrors(fieldErrors(error));

      handleToast(
        typeof detail === "string"
          ? detail
          : (isRecord(detail) ? detail.message : undefined) ?? "Could not save. Check the fields and try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editForm || editSaving) return;

    setEditSaving(true);
    setEditErrors({});

    try {
      const response = await api.post<MenuUpdateResponse>(
        `/${modulePath}/update`,
        editForm,
        { timeout: 15000 }
      );

      const updated = response.data.menu;

      setMenus((current) =>
        current.map((menu) => {
          if (menu.id === updated.id) {
            return { ...menu, ...updated };
          }

          return {
            ...menu,
            children: (menu.children ?? []).map((child) =>
              child.id === updated.id
                ? { ...child, ...updated }
                : child
            ),
          };
        })
      );

      setInActiveMenus((current) =>
        current.map((menu) => {
          if (menu.id === updated.id) {
            return { ...menu, ...updated };
          }

          return {
            ...menu,
            children: (menu.children ?? []).map((child) =>
              child.id === updated.id
                ? { ...child, ...updated }
                : child
            ),
          };
        })
      );

      setEditForm(null);
      handleToast("Menu updated.", "success");
    } catch (error) {
      const detail = errorDetail(error);

      setEditErrors(fieldErrors(error));

      handleToast(
        typeof detail === "string"
          ? detail
          : "Could not save. Check the fields and try again.",
        "error"
      );
    } finally {
      setEditSaving(false);
    }
  };

  useEffect(() => {
    let active = true;
    api
      .get<MenusIndexResponse>(`/${modulePath}`)
      .then((res) => {
        if (!active) return;
        setData(res.data);
        setMenus(res.data.menus);
        setInActiveMenus(res.data.inactive_menus);
      })
      .catch(() => {
        if (active) setError("Could not load menus.");
      });
    return () => {
      active = false;
    };
  }, [modulePath]);

  useEffect(() => {
    let active = true;
    api
      .get<SelectOption[]>(`/${modulePath}/roles`)
      .then((res) => {
        if (active) setRoles(res.data ?? []);
      })
      .catch(() => {
        if (active) setError("Could not load menus.");
      });
    return () => {
      active = false;
    };
  }, [modulePath]);

  if (error) {
    return (
      <ContentPanel>
        <p className="m-0 text-[13px] text-skin-danger">{error}</p>
      </ContentPanel>
    );
  }

  if (!data) {
    return (
      <ContentPanel>
        <p className="m-0 text-[13px] text-skin-dim">Loading menus...</p>
      </ContentPanel>
    );
  }

  const handleDrop = (parentId: number | null, to: number) => {
    setDropTarget(null);
    const from = dragFrom.current;

    dragFrom.current = null;
    setDragging(null);

    if (savePending.current || !from) return;

    const source =
      from.parentId === null
        ? menus
        : menus.find((menu) => menu.id === from.parentId)?.children;

    if (!source) return;
    const moved = source[from.index];
    if (!moved) return;

    const sameGroup = from.parentId === parentId;

    const insertAt =
      sameGroup && from.index < to ? to - 1 : to;

    if (sameGroup && from.index === insertAt) return;

    // A menu cannot become its own child.
    if (moved.id === parentId) return;

    // Keep the existing one-level tree structure.
    if (parentId !== null && (moved.children?.length ?? 0) > 0) {
      handleToast(
        "Move this menu's children first before nesting it.",
        "error"
      );
      return;
    }

    const destination =
      parentId === null
        ? menus
        : menus.find((menu) => menu.id === parentId)?.children;

    if (!destination) return;

    const previous = menus;

    // Remove the item from its current group.
    const remaining = source.filter((menu) => menu.id !== moved.id);

    // For a same-group move, insert into the shortened source.
    const ordered = sameGroup ? [...remaining] : [...destination];

    ordered.splice(insertAt, 0, {
      ...moved,
      children: moved.children ?? [],
    });

    // Replace the source and destination arrays in the tree.
    let next =
      parentId === null
        ? ordered
        : from.parentId === null
          ? remaining
          : [...menus];

    next = next.map((menu) => {
      if (menu.id === parentId) {
        return { ...menu, children: ordered };
      }

      if (!sameGroup && menu.id === from.parentId) {
        return { ...menu, children: remaining };
      }

      return menu;
    });

    setMenus(next);
    saveMove(moved.id, parentId, ordered, previous);
  };

  const canDropAt = (parentId: number | null) => {
    const source = dragFrom.current;
    if (savePending.current || !source) return false;

    const siblings =
      source.parentId === null
        ? menus
        : menus.find((menu) => menu.id === source.parentId)?.children;

    const moved = siblings?.[source.index];
    if (!moved) return false;

    if (moved.id === parentId) return false;

    // Existing backend supports only one child level.
    if (parentId !== null && (moved.children?.length ?? 0) > 0) {
      return false;
    }

    return true;
  };

  const makeTarget = (parentId: number | null, index: number): DropTarget => ({
    key: `${parentId ?? "root"}-${index}`, parentId, index,
  });

  // Cards accept drops too; their upper/lower halves select adjacent gaps.
  const resolveCardTarget = (event: DragEvent<HTMLElement>, parentId: number | null, index: number) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const after = event.clientY >= bounds.top + bounds.height / 2;
    const menu = parentId === null ? menus[index] : null;
    const movedRight = event.clientX - (dragFrom.current?.clientX ?? event.clientX) >= 32;

    if (menu && movedRight && canDropAt(menu.id)) {
      return makeTarget(menu.id, menu.children?.length ?? 0);
    }
    return makeTarget(parentId, index + (after ? 1 : 0));
  };

  // Gap indices refer to the list before removing the dragged card.
  const resolveGapTarget = (event: DragEvent<HTMLElement>, parentId: number | null, index: number) => {
    let targetParentId = parentId;
    let targetIndex = index;

    // Measure intentional horizontal movement, not the cursor's absolute
    // position inside a wide card. Invalid nesting falls back to root order.
    if (parentId === null && index > 0) {
      const parent = menus[index - 1];
      const movedRight = event.clientX - (dragFrom.current?.clientX ?? event.clientX) >= 32;
      if (movedRight && canDropAt(parent.id)) {
        targetParentId = parent.id;
        targetIndex = parent.children?.length ?? 0;
      }
    }

    return makeTarget(targetParentId, targetIndex);
  };

  // Render passes only the drop area's position; the resolvers, which read
  // the drag refs, run inside these event handlers.
  const getDropProps = (area: "card" | "gap", parentId: number | null, index: number): DropProps => {
    const resolveTarget = (event: DragEvent<HTMLElement>) =>
      area === "card"
        ? resolveCardTarget(event, parentId, index)
        : resolveGapTarget(event, parentId, index);

    return {
      onDragOver: (event) => {
        event.stopPropagation();
        const target = resolveTarget(event);
        if (!canDropAt(target.parentId)) {
          event.dataTransfer.dropEffect = "none";
          setDropTarget(null);
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDropTarget((previous) => previous?.key === target.key ? previous : target);
      },
      onDragLeave: (event) => {
        if (event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget)) return;
        setDropTarget(null);
      },
      onDrop: (event) => {
        event.preventDefault();
        event.stopPropagation();
        const target = resolveTarget(event);
        setDropTarget(null);
        if (canDropAt(target.parentId)) handleDrop(target.parentId, target.index);
      },
    };
  };

  const getDragProps = (parentId: number | null, index: number): DragProps => ({
    draggable: !saving,
    ...getDropProps("card", parentId, index),

    onDragStart: (event) => {
      if (savePending.current) {
        event.preventDefault();
        return;
      }

      const source = { parentId, index, clientX: event.clientX };

      dragFrom.current = source;
      setDragging(source);
      setDropTarget(null);

      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", JSON.stringify(source));
    },

    onDragEnd: () => {
      dragFrom.current = null;
      setDragging(null);
      setDropTarget(null);
    },
  });

  const renderGap = (parentId: number | null, index: number) => {
    const key = `${parentId ?? "root"}-${index}`;
    const active = dropTarget?.key === key;

    return (
      <div
        key={key}
        className="relative h-2 shrink-0"
        {...getDropProps("gap", parentId, index)}
      >
        <div
          className={`pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 items-center gap-2 ${active ? "opacity-100" : "opacity-0"}`}
          aria-hidden="true"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-skin-accent" />
          <span className="h-px flex-1 bg-skin-accent" />
          <span className="rounded border border-skin-accent bg-skin-panel px-2 py-0.5 text-[10px] font-medium text-skin-accent">
            {parentId === null ? "Top level" : "Child menu"}
          </span>
        </div>
      </div>
    );
  };

  const renderGroup = (items: Menu[], parentId: number | null = null) => (
    <>
      {items.map((menu, index) => (
        <Fragment key={menu.id}>
          {renderGap(parentId, index)}
          <MenuCard
            menu={menu}
            nested={parentId !== null}
            parentId={parentId}
            index={index}
            dragging={dragging}
            getDragProps={getDragProps}
            onEdit={openEdit}
          />
          {parentId === null && (
            <div className={`ml-4 border-l pl-3 sm:ml-5 sm:pl-4 ${menu.children?.length ? "border-skin-border" : "border-transparent"}`}>
              {renderGroup(menu.children ?? [], menu.id)}
            </div>
          )}
        </Fragment>
      ))}
      {renderGap(parentId, items.length)}
    </>
  );

  return (
    <ContentPanel>
      <section className="flex-row md:flex gap-3">
        <div className="w-full">
          <div className="mb-2">
            <header className="rounded-t-lg border border-skin-border bg-skin-panel px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="m-0 text-[15px] font-semibold text-skin-text">Menu order</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-skin-accent-soft px-2 py-1 text-[10px] font-medium text-skin-accent" role="status">
                  <span className="h-1.5 w-1.5 rounded-full bg-skin-accent" aria-hidden="true" />
                  {saving ? "Saving..." : "Active menus"}
                </span>
              </div>
              <p className="m-0 mt-1 text-xs leading-relaxed text-skin-dim">
                Drag to reorder. Move right to nest a menu without children.
              </p>
            </header>
            <div className="flex flex-col rounded-b-lg border border-t-0 border-skin-border bg-skin-bg p-3" aria-busy={saving}>
              {menus.length === 0 ? (
                <p className="m-0 py-6 text-center text-[13px] text-skin-dim">
                  No active menus yet.
                </p>
              ) : (
                renderGroup(menus)
              )}
            </div>
          </div>
          <div className="mt-2">
            <header className="rounded-t-lg border border-skin-border bg-skin-panel px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="m-0 text-[15px] font-semibold text-skin-text">Menu order</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-skin-danger-soft px-2 py-1 text-[10px] font-medium text-skin-danger" role="status">
                  <span className="h-1.5 w-1.5 rounded-full bg-skin-danger" aria-hidden="true" />
                  {saving ? "Saving..." : "In Active menus"}
                </span>
              </div>
              <p className="m-0 mt-1 text-xs leading-relaxed text-skin-dim">
                Drag to reorder. Move right to nest a menu without children.
              </p>
            </header>
            <div className="flex flex-col rounded-b-lg border border-t-0 border-skin-border bg-skin-bg p-3" aria-busy={saving}>
              {inActiveMenus.length === 0 ? (
                <p className="m-0 py-6 text-center text-[13px] text-skin-dim">
                  No In active menus yet.
                </p>
              ) : (
                // Known limitation, kept from the React page: these cards
                // reuse drag handlers that index the active tree.
                renderGroup(inActiveMenus)
              )}
            </div>
          </div>
        </div>
        <div className="w-full">
          <header className="rounded-t-lg border border-skin-border bg-skin-panel px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="m-0 text-[15px] font-semibold text-skin-text">Add menu</h2>
            </div>
          </header>
          <div className="flex flex-col rounded-b-lg border border-t-0 border-skin-border bg-skin-bg p-3">
            <form className="space-y-4" onSubmit={saveAdd}>
              <MenuFormFields
                form={addForm}
                setForm={setAddForm}
                errors={addErrors}
                setErrors={setAddErrors}
                roles={roles}
                idPrefix="menu-add"
                autoFocusName
              />

              <div className="flex justify-end gap-2 border-t border-skin-border pt-4">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setAddForm({ ...EMPTY_MENU_FORM });
                    setAddErrors({});
                  }}
                  className="rounded-md border border-skin-border px-3 py-2 text-sm text-skin-text disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-skin-accent-soft px-3 py-2 text-sm font-semibold text-skin-accent disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <Modal
        show={editForm !== null}
        title="Edit menu"
        dismissible={!editSaving}
        onClose={() => {
          if (!editSaving) setEditForm(null);
        }}
      >
        {editForm && (
          <form onSubmit={saveEdit} className="space-y-4">
            <MenuFormFields
              form={editForm}
              setForm={(update) => setEditForm((current) => (current ? update(current) : current))}
              errors={editErrors}
              setErrors={setEditErrors}
              roles={roles}
              disabled={editSaving}
              idPrefix="menu-edit"
              autoFocusName
            />

            <div className="flex justify-end gap-2 border-t border-skin-border pt-4">
              <button
                type="button"
                disabled={editSaving}
                onClick={() => setEditForm(null)}
                className="rounded-md border border-skin-border px-3 py-2 text-sm text-skin-text disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={editSaving}
                className="rounded-md bg-skin-accent-soft px-3 py-2 text-sm font-semibold text-skin-accent disabled:opacity-50"
              >
                {editSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </ContentPanel>
  );
}
