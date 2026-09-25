import type { DragEventHandler } from "react";
import { GripVertical, Pencil, Users } from "lucide-react";
import type { DragSource, Menu } from "./types";

export type DropProps = {
  onDragOver: DragEventHandler<HTMLElement>;
  onDragLeave: DragEventHandler<HTMLElement>;
  onDrop: DragEventHandler<HTMLElement>;
};

export type DragProps = DropProps & {
  draggable: boolean;
  onDragStart: DragEventHandler<HTMLElement>;
  onDragEnd: DragEventHandler<HTMLElement>;
};

type MenuCardProps = {
  menu: Menu;
  nested?: boolean;
  parentId?: number | null;
  index: number;
  dragging: DragSource | null;
  getDragProps: (parentId: number | null, index: number) => DragProps;
  onEdit: (menu: Menu) => void;
};

export default function MenuCard({ menu, nested = false, parentId = null, index, dragging, getDragProps, onEdit }: MenuCardProps) {
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
              {!nested && (menu.children?.length ?? 0) > 0 && (
                <span className="shrink-0 rounded bg-skin-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-skin-accent">
                  {menu.children?.length}
                </span>
              )}
            </p>
            <p className="m-0 mt-1 flex items-center gap-2 text-[12px] text-skin-dim">
              <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {(menu.roles ?? []).length
                ? (menu.roles ?? []).map((role) => role.name).join(", ")
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
