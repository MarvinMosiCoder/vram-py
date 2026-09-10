# Themes and frontend

Use existing controls under `frontend/src/components/` for buttons, forms, tables,
modals, and avatars. Module-specific rendering belongs in a wrapper or custom
module page. The app uses Tailwind v4 with runtime CSS variables; preserve the
current React Router/Axios architecture.

## Theme process

The authenticated role supplies `theme_color`. ThemeProvider and
`config/themeOptions.js` resolve named skins/custom hex values and set document
colors. `useThemeStyles()` bridges legacy components to shared tokens. A personal
saved-theme dialog from Laravel is not currently implemented in this port.

| Black-theme token | Color |
| --- | --- |
| Page background | `#0f1115` |
| Panel | `#171a21` |
| Border | `#262b35` |
| Main text | `#e7e6e1` |
| Muted text | `#8a8f9c` |
| Mint accent | `#3ecf8e` |
| Text on mint actions | `#0b0d10` |
| Error accent | `#e2665a` |

The black theme retains `skin-black` / `bg-skin-black` identity while adopting
the login charcoal/green palette. Primary controls and active navigation use mint;
surfaces remain charcoal. Profile `--das-*` aliases follow these tokens in black
mode. The `.login-theme` palette is scoped independently of the signed-in role.

Check light/black themes, narrow viewports, focus states, dropdowns, and modals
when changing shared styling. Keep icon controls labeled and preserve text/icons
alongside status colors. The navbar has mobile-specific layout rules and the
sidebar becomes an overlay; avoid clipping either with new fixed-width content.

For notification colors, see [response notifications](notifications.md).

## Chat composer

The chat composer, its settings selector, and its theme usage are documented
in the [AI chat](ai-chat.md) guide.
