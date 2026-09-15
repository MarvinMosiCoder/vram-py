import { useEffect, useState } from "react";
import { Pencil, Users } from "lucide-react";
import api from "../../../api";
import ContentPanel from "../../../components/panel/ContentPanel";

function MenuCard({ menu, nested = false }) {
  return (
    <div className={nested ? "ml-6" : ""}>
      <article className="flex items-start justify-between gap-3 rounded-lg border border-skin-border bg-skin-panel px-4 py-3">
        <div className="min-w-0">
          <p className="m-0 flex items-center gap-2 text-[13px] font-semibold text-skin-text">
            {menu.icon && <i className={`${menu.icon} text-skin-accent`} aria-hidden="true" />}
            {menu.name}
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
        >
          <Pencil className="h-4 w-4" />
        </button>
      </article>

      {menu.children?.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          {menu.children.map((child) => (
            <MenuCard key={child.id} menu={child} nested />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MenusPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/menus")
      .then((res) => setData(res.data))
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

  return (
    <ContentPanel>
      <section>
        <header className="rounded-t-lg border border-skin-border bg-skin-accent-soft px-4 py-3">
          <h2 className="m-0 text-[15px] font-semibold text-skin-accent">
            Menu Order (Active)
          </h2>
        </header>
        <div className="flex flex-col gap-2 rounded-b-lg border border-t-0 border-skin-border bg-skin-bg p-3">
          {data.menus.length === 0 ? (
            <p className="m-0 py-6 text-center text-[13px] text-skin-dim">
              No active menus yet.
            </p>
          ) : (
            data.menus.map((menu) => <MenuCard key={menu.id} menu={menu} />)
          )}
        </div>
      </section>
    </ContentPanel>
  );
}
