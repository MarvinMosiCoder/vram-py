import MenusPage from "@/components/menus/MenusPage";

// A custom page rather than the generated module runtime: MenusController
// declares no table_fields. This static folder takes precedence over the
// [modulePath] catch-all.
export default function Page() {
  return <MenusPage modulePath="menus" />;
}
