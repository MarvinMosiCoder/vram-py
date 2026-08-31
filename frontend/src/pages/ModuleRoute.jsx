import { useParams } from "react-router-dom";

import GeneratedModulePage from "./admvram/vramjsx/GeneratedModulePage";
import { MODULE_PAGES } from "./modulePages";

// Sits behind the single "/:modulePath" route and picks the component:
// a registered wrapper page if the module has one, otherwise the shared
// runtime with no customisation.
export default function ModuleRoute() {
  const { modulePath } = useParams();
  const Page = MODULE_PAGES[modulePath];

  // key= forces a remount when you click a different sidebar entry, so
  // the page never shows the previous module's rows while loading.
  return Page ? <Page key={modulePath} /> : <GeneratedModulePage key={modulePath} />;
}
