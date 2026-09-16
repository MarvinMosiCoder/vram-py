import { Fragment, useEffect, useState, useRef } from "react";
import { GripVertical, Pencil, Users } from "lucide-react";
import api from "../../../api";
import ContentPanel from "../../../components/panel/ContentPanel";
import { useToast } from "../../../context/ToastContext";
import Modal from "../../../components/modal/Modal";
import TextInput from "../../../components/form/TextInput";
import InputError from "../../../components/form/InputError";
import SelectInput from "../../../components/form/SelectInput";

const TYPES = [
  {
    value: 'Route',
    label: 'Route'
  },
  {
    value: 'URL',
    label: 'URL'
  }
];

function MenuCard({ menu, nested = false, parentId = null, index, dragging, getDragProps, onEdit }) {
  const isDragging =
    dragging?.parentId === parentId &&
    dragging?.index === index;

  const dragProps = getDragProps(parentId, index);
  return (
    <div>
      <article
        {...dragProps}
        title={`Drag ${menu.name} to reorder`}
        className={`group flex select-none items-center gap-3 rounded-lg border border-skin-border bg-skin-panel px-3 py-3 transition-colors hover:border-skin-accent ${
          dragProps.draggable ? "cursor-grab active:cursor-grabbing" : "cursor-wait"
        } ${isDragging ? "opacity-40" : ""}`}>
        <GripVertical className="h-4 w-4 shrink-0 text-skin-dim opacity-50 group-hover:opacity-100" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="m-0 flex items-center gap-2 text-[13px] font-semibold text-skin-text">
            {menu.icon && <i className={`${menu.icon} text-skin-accent`} aria-hidden="true" />}
            <span className="truncate">{menu.name}</span>
            {!nested && menu.children?.length > 0 && (
              <span className="shrink-0 rounded bg-skin-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-skin-accent">
                {menu.children.length}
              </span>
            )}
          </p>
          <p className="m-0 mt-1 flex items-center gap-2 text-[12px] text-skin-dim">
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {menu.roles.length
                ? menu.roles.map((role) => role.name).join(", ")
                : "No roles assigned"}
            </span>
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md p-1.5 text-skin-dim transition hover:bg-skin-accent-soft hover:text-skin-accent focus-visible:outline-2 focus-visible:outline-skin-accent"
          aria-label={`Edit ${menu.name}`}
          title="Edit"
          draggable={false}
          onClick={(event) => {
            event.stopPropagation();
            onEdit(menu);
          }}
        >
          <Pencil className="h-4 w-4" />
        </button>
      </article>

    </div>
  );
}

export default function MenusPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [menus, setMenus] = useState([]);
  const dragFrom = useRef(null);
  const savePending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const { handleToast } = useToast();
  const [editing, setEditing] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [roles, setRoles] = useState([]);

  const saveMove = async (menuId, parentId, ordered, previous) => {
    savePending.current = true;
    setSaving(true);

    try {
      await api.post("/menus/move", {
        menu_id: menuId,
        parent_id: parentId,
        ids: ordered.map((menu) => menu.id),
      }, { timeout: 15000 });

      handleToast("Menu moved.", "success");
    } catch (error) {
      // A timed-out write may still have committed. Read the server's order
      // before permitting another move instead of assuming it was rolled back.
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        try {
          const response = await api.get("/menus", { timeout: 10000 });
          setMenus(response.data.menus);
          handleToast("The save timed out. Menu order was refreshed; you can drag again.", "warning");
        } catch {
          setError("The menu server is not responding. Refresh this page once it is available.");
        }
        return;
      }
      setMenus(previous);

      const detail = error.response?.data?.detail;
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

  const openEdit = (menu) => {
    if (savePending.current || editSaving) return;
    setEditErrors({});
    setEditing({
      id: menu.id,
      name: menu.name ?? '',
      path: menu.path ?? '',
      icon: menu.icon ?? '',
      roles: menu.roles ?? [],
      type: menu.type ?? '',
      status: menu.is_active ?? '',
      is_dashboard: menu.is_dashboard ?? ''
    });
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editing || editSaving) return;

    setEditSaving(true);
    setEditErrors({});

    try {
      const response = await api.post(
        "/menus/update",
        editing,
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

      setEditing(null);
      handleToast("Menu updated.", "success");
    } catch (error) {
      const detail = error.response?.data?.detail;

      if (detail && typeof detail === "object" && !Array.isArray(detail)) {
        setEditErrors(detail);
      }

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
    api
      .get("/menus")
      .then((res) => {
        setData(res.data);
        setMenus(res.data.menus);
      })
      .catch(() => setError("Could not load menus."));
  }, []);

  useEffect(() => {
    api
      .get("/menus/roles")
      .then((res) => {
        setRoles(res.data ?? []);
      })
      .catch(() => setError("Could not load menus."));
  }, []);

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

  const handleDrop = (parentId, to) => {
    setDropTarget(null);
    const from = dragFrom.current;

    dragFrom.current = null;
    setDragging(null);

    if (savePending.current || !from) return;

    const source =
      from.parentId === null
        ? menus
        : menus.find((menu) => menu.id === from.parentId)?.children;

    const moved = source?.[from.index];
    if (!moved) return;

    const sameGroup = from.parentId === parentId;

    const insertAt =
      sameGroup && from.index < to ? to - 1 : to;

    if (sameGroup && from.index === insertAt) return;

    // A menu cannot become its own child.
    if (moved.id === parentId) return;

    // Keep the existing one-level tree structure.
    if (parentId !== null && moved.children?.length > 0) {
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

  const getDragProps = (parentId, index) => ({
    draggable: !saving,
    ...getDropProps((event) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const after = event.clientY >= bounds.top + bounds.height / 2;
      const menu = parentId === null ? menus[index] : null;
      const movedRight = event.clientX - (dragFrom.current?.clientX ?? event.clientX) >= 32;

      // Cards accept drops too; their upper/lower halves select adjacent gaps.
      if (menu && movedRight && canDropAt(menu.id)) {
        return makeTarget(menu.id, menu.children?.length ?? 0);
      }
      return makeTarget(parentId, index + (after ? 1 : 0));
    }),

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

  const canDropAt = (parentId) => {
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
    if (parentId !== null && moved.children?.length > 0) {
      return false;
    }

    return true;
  };

  const makeTarget = (parentId, index) => ({
    key: `${parentId ?? "root"}-${index}`, parentId, index,
  });

  const getDropProps = (resolveTarget) => ({
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
  });

  // Gap indices refer to the list before removing the dragged card.
  const renderGap = (parentId, index) => {
    const key = `${parentId ?? "root"}-${index}`;
    const active = dropTarget?.key === key;

    const resolveTarget = (event) => {
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

    return (
      <div
        key={key}
        className="relative h-2 shrink-0"
        {...getDropProps(resolveTarget)}
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
  console.log(editing)
  const renderGroup = (items, parentId = null) => (
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
      <section>
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
      </section>
      <Modal
        show={editing !== null}
        title="Edit menu"
        dismissible={!editSaving}
        onClose={() => {
          if (!editSaving) setEditing(null);
        }}
      >
        {editing && (
          <form onSubmit={saveEdit} className="space-y-4">
            {[
              ["roles", "Roles"],
              ["name", "Menu name"],
              ["path", "Path"],
              ["icon", "Icon class"],
              ["type", "Type"]
              
            ].map(([field, label]) => (
              <div key={field} className="space-y-1.5">
                <label
                  htmlFor={`menu-edit-${field}`}
                  className="block text-xs text-skin-dim"
                >
                  {label}
                </label>

                {
                  (['roles','type']).includes(field) ? (
                    <>
                      {
                        field === 'roles' ?
                        <SelectInput
                          type="react-select"
                          value={roles.filter((option) =>
                            (editing.roles ?? []).some(
                              (role) => role.id === option.value
                            )
                          )}
                          options={roles}
                          placeholder="Choose roles"
                          onChange={(selected) => {
                            setEditing((current) => ({
                              ...current,
                              roles: (selected ?? []).map((option) => ({
                                id: option.value,
                                name: option.label,
                              })),
                            }));
  
                            setEditErrors((current) => ({
                              ...current,
                              roles: "",
                            }));
                          }}
                          disabled={editSaving}
                          isMulti
                        />
                          :
                        <SelectInput
                          type="react-select"
                          value={TYPES.filter((option) => editing.type === option.value)}
                          options={TYPES}
                          placeholder="Choose Type"
                          onChange={(selected) => {
                            setEditing((current) => ({
                              ...current,
                              type: selected.value,
                            }));

                            setEditErrors((current) => ({
                              ...current,
                              type: "",
                            }));
                          }}
                          disabled={editSaving}
                        />
                      }

                    </>
                  ) 
                  : 
                  <TextInput
                    id={`menu-edit-${field}`}
                    value={editing[field]}
                    required={field === "name"}
                    maxLength={255}
                    disabled={editSaving}
                    autoFocus={field === "name"}
                    aria-invalid={Boolean(editErrors[field])}
                    onChange={(event) => {
                      const value = event.target.value;
  
                      setEditing((current) => ({
                        ...current,
                        [field]: value,
                      }));
  
                      setEditErrors((current) => ({
                        ...current,
                        [field]:'',
                      }));
                    }}
                  />
                }
                

                <InputError message={editErrors[field]} />
              </div>
            ))}

            <div className="flex justify-end gap-2 border-t border-skin-border pt-4">
              <button
                type="button"
                disabled={editSaving}
                onClick={() => setEditing(null)}
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
