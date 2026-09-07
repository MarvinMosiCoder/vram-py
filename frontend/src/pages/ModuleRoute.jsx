import { useParams } from "react-router-dom";

import GeneratedModulePage from "./admvram/vramjsx/GeneratedModulePage";
import { MODULE_PAGES } from "./modulePages";

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
