import { useParams } from "react-router-dom";

import GeneratedModulePage from "./admvram/vramjsx/GeneratedModulePage";
import { MODULE_PAGES } from "./modulePages";

// Sits behind the single "/:modulePath/*" route in App.jsx and picks the
// page. This is the one place a URL is split into the parts the rest of the
// app works in -- the splat holds everything after the module path:
//
//   /roles                     -> path "roles", action undefined
//   /roles/add                 -> path "roles", action "add"
//   /roles/edit/7              -> path "roles", action "edit",  args ["7"]
//   /roles/edit-permissions/7  -> path "roles", action "edit-permissions",
//                                 args ["7"]
//
// Which is the same shape dynamic.py already dispatches on the backend, so
// one URL convention -- /<module_path>/<action>/<args...> -- covers both
// sides and neither needs a route added per feature.
//
// Resolution is most-specific-first: a page registered for
// "roles/edit-permissions" wins over the module's own "roles" page, which
// wins over the shared runtime. Nothing is listed by hand -- see
// modulePages.js.
export default function ModuleRoute() {
  const { modulePath, "*": splat = "" } = useParams();
  const [action, ...args] = splat.split("/").filter(Boolean);

  const Page =
    (action && MODULE_PAGES[`${modulePath}/${action}`]) || MODULE_PAGES[modulePath];

  // key= forces a remount when you click a different sidebar entry or move
  // between actions, so a page never shows the previous one's data while
  // loading.
  const key = `${modulePath}/${action ?? ""}`;
  const props = { modulePath, action, args };

  return Page ? (
    <Page key={key} {...props} />
  ) : (
    <GeneratedModulePage key={key} {...props} />
  );
}
