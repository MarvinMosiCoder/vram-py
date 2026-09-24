// Run against `npm run start -- --port 3100`. All API requests are mocked.
// Set PLAYWRIGHT_MODULE to an installed Playwright package path if necessary.
/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");

async function run() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(() => localStorage.setItem("token", "test"));
      const page = await context.newPage();
      const errors = [], saves = [];
      let failLoad = false, failSave = false, denyWrite = false;
      page.on("pageerror", error => errors.push(error.message));
      const metadata = {
        module: { name: "Users", path: "users" }, tableName: "adm_users", primaryKey: "id",
        columns: ["id", "name", "email", "role_name"].map(key => ({ key, label: key === "role_name" ? "Role" : key === "id" ? "ID" : key[0].toUpperCase() + key.slice(1) })),
        rows: [{ id: 2, name: "Test Staff", email: "staff@example.com", role_name: "Staff" }],
        pagination: { page: 1, per_page: 15, total: 16, last_page: 2 },
        formFields: { name: { label: "Name", type: "text" }, email: { label: "Email", type: "email" }, id_adm_role: { label: "Role", type: "react-select", options: [{ value: 2, label: "Staff" }] }, password: { label: "Password", type: "password" } },
        actions: { view: true, create: true, edit: true, delete: false },
        moduleAccess: { view: true, create: true, update: true, delete: false }, useAddRoute: true, useEditRoute: true,
      };
      await context.route("http://localhost:8080/**", async route => {
        const req = route.request(), url = new URL(req.url()), path = url.pathname;
        let data = [], status = 200;
        if (path === "/me") data = { id: 1, email: "admin@example.com", name: "Admin", role: "Admin", role_id: 1, is_superadmin: true, theme_color: width === 390 ? "bg-skin-blue" : "bg-skin-black" };
        else if (path === "/password-policy") data = { must_change: false };
        else if (path === "/system/appname") data = "VRAM";
        else if (path === "/system/logo") data = "/images/settings/vram-logo/vram-logo.webp";
        else if (path === "/notification/notifications") data = { notifications: [], unread_count: 0 };
        else if (["/users/store", "/users/update"].includes(path)) {
          saves.push(req.postDataJSON()); status = failSave ? 400 : 200;
          data = failSave ? { detail: "Email must be unique." } : {};
        } else if (["/users/add", "/users/edit/2"].includes(path)) {
          status = failLoad ? 500 : 200;
          data = failLoad ? { detail: "Form unavailable" } : { ...metadata, pageMode: path.endsWith("/add") ? "create" : "edit", editRow: path.endsWith("/2") ? { id: 2, name: "Test Staff", email: "staff@example.com", role_name: "Staff" } : null };
        } else if (path === "/users") data = { ...metadata, actions: { ...metadata.actions, create: !denyWrite, edit: !denyWrite }, pagination: { ...metadata.pagination, page: Number(url.searchParams.get("page") || 1) } };
        else if (path === "/users/export") {
          await route.fulfill({ status: 200, contentType: "text/csv", body: "id,name\n2,Test Staff", headers: { "Access-Control-Allow-Origin": "*", "Content-Disposition": 'attachment; filename="users.csv"' } });
          return;
        }
        await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data), headers: { "Access-Control-Allow-Origin": "*" } });
      });
      const responseDuring = (predicate, action) => Promise.all([page.waitForResponse(r => predicate(new URL(r.url()))), action()]);
      await page.goto("http://localhost:3100/users");
      await page.getByRole("cell", { name: "Test Staff", exact: true }).waitFor();
      await responseDuring(url => url.searchParams.get("page") === "2", () => page.getByRole("button", { name: "Next", exact: true }).click());
      await page.getByText("Page 2 of 2", { exact: false }).waitFor();
      await page.getByTitle("View", { exact: true }).click();
      await page.getByRole("heading", { name: "Record 2", exact: true }).waitFor();
      assert.equal(await page.locator('input[type="password"]').count(), 0);
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await responseDuring(url => url.searchParams.get("search") === "Staff", () => page.getByLabel("Search records").fill("Staff"));
      await responseDuring(url => url.searchParams.get("sort_by") === "name", () => page.getByRole("columnheader", { name: "Name", exact: true }).click());
      await page.getByRole("button", { name: "Export", exact: true }).click();
      const [exportResponse] = await responseDuring(url => url.pathname === "/users/export", () => page.getByRole("button", { name: "Download", exact: true }).click());
      assert.equal(new URL(exportResponse.url()).searchParams.get("search"), "Staff");
      assert.equal(new URL(exportResponse.url()).searchParams.get("sort_by"), "name");
      await page.getByRole("button", { name: "New", exact: true }).click();
      await page.waitForURL("**/users/add");
      await page.getByRole("heading", { name: /Add User/ }).waitFor({timeout: 5000}).catch(async error => {
        console.error("Navigation diagnostic", page.url(), await page.locator("body").innerText(), errors);
        throw error;
      });
      await page.getByRole("textbox", { name: "Name", exact: true }).fill("Created User");
      await page.getByRole("textbox", { name: "Email", exact: true }).fill("created@example.com");
      await page.getByRole("combobox").click();
      await page.getByRole("option", { name: "Staff", exact: true }).click();
      await page.getByLabel(/^Password/).fill("example-password");
      await page.getByRole("button", { name: /Save/ }).click();
      await page.waitForURL("**/users");
      assert.equal(saves.at(-1).name, "Created User");
      assert.equal(saves.at(-1).password, "example-password");
      await page.goto("http://localhost:3100/users/edit/2");
      await page.getByRole("textbox", { name: "Name", exact: true }).waitFor();
      assert.equal(await page.getByRole("textbox", { name: "Name", exact: true }).inputValue(), "Test Staff");
      await page.getByText("Staff", { exact: true }).waitFor();
      await page.getByRole("textbox", { name: "Name", exact: true }).fill("Updated Staff");
      failSave = true;
      await page.getByRole("button", { name: /Save/ }).click();
      await page.getByText("Email must be unique.", { exact: true }).waitFor();
      assert.equal(saves.at(-1).password, undefined);
      assert.deepEqual(Object.keys(saves.at(-1)).sort(), ["email", "id", "id_adm_role", "name"]);
      failSave = false;
      await page.getByRole("button", { name: /Save/ }).click();
      await page.waitForURL("**/users");
      failLoad = true;
      await page.goto("http://localhost:3100/users/edit/2");
      await page.getByText("Form unavailable", { exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: /Save/ }).count(), 0);
      failLoad = false;
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await page.getByRole("textbox", { name: "Name", exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      denyWrite = true;
      await page.goto("http://localhost:3100/users");
      await page.getByRole("cell", { name: "Test Staff", exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "New", exact: true }).count(), 0);
      assert.equal(await page.getByTitle("Edit", { exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: list, pagination, view, search, sort, export filters, create, edit, validation, blank password, retry, permissions, no overflow or page errors`);
      await context.close();
    }
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
