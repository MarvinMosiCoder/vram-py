import { notFound } from "next/navigation";
import GeneratedModulePage from "@/components/modules/GeneratedModulePage";

// Fallback for modules without a custom page, replacing the legacy
// ModuleRoute. Static folders such as users/ and roles/ take precedence, so a
// module needs a folder here only when it needs custom rendering.
//
//   /<module>              index
//   /<module>/add          generated add form
//   /<module>/edit/<id>    generated edit form
export default async function Page({ params }: PageProps<"/[modulePath]/[[...rest]]">) {
  const { modulePath, rest = [] } = await params;
  if (!/^[A-Za-z0-9_-]+$/.test(modulePath)) notFound();

  const [action, recordId, ...extra] = rest;
  if (extra.length > 0) notFound();
  if (action === undefined) {
    return <GeneratedModulePage key={modulePath} modulePath={modulePath} />;
  }
  if (action === "add" && recordId === undefined) {
    return <GeneratedModulePage key={`${modulePath}/add`} modulePath={modulePath} action="add" />;
  }
  if (action === "edit" && recordId && /^[1-9]\d*$/.test(recordId)) {
    return (
      <GeneratedModulePage
        key={`${modulePath}/edit/${recordId}`}
        modulePath={modulePath}
        action="edit"
        recordId={recordId}
      />
    );
  }
  notFound();
}
