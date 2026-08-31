// Ported from the Laravel project's resources/js/Config/themeOptions.js
// (C:\laragon\www\vram) so the contract matches exactly -- ThemeContext,
// AppContent, AppFooter and RowData all compare against these return values.
//
// Canonical client-side source for the theme chooser. Legacy skins and the
// dashboard palette both live here; custom hex colors are validated and
// resolved into CSS custom properties so every consumer -- Tailwind classes,
// inline styles, or hand-written CSS -- reads a single source of truth.
//
// Differences from the Laravel original, and only these:
//   - no SweetAlert consumer here, so nothing reads the tokens for one
//   - adm_roles.theme_color is the only source of a preference; there is no
//     per-user theme table yet, so normalizeThemePreference() sees role values

export const SYSTEM_THEME_ID = 'system';

export const legacyThemeOptions = [
    { id: 'skin-blue', name: 'Blue', hex: '#134B70' },
    { id: 'skin-blue-light', name: 'Light Blue', hex: '#508C9B' },
    { id: 'skin-green', name: 'Green', hex: '#00A65A' },
    { id: 'skin-green-light', name: 'Light Green', hex: '#508D4E' },
    { id: 'skin-yellow', name: 'Yellow', hex: '#E08E0B' },
    { id: 'skin-yellow-light', name: 'Light Yellow', hex: '#FFB200' },
    { id: 'skin-purple', name: 'Purple', hex: '#BC5A94' },
    { id: 'skin-purple-light', name: 'Light Purple', hex: '#F075AA' },
    { id: 'skin-red', name: 'Red', hex: '#DD4B39' },
    { id: 'skin-red-light', name: 'Light Red', hex: '#E72929' },
    { id: 'skin-black', name: 'Black', hex: '#242627' },
    { id: 'skin-black-light', name: 'Soft Black', hex: '#31363F' },
    { id: 'skin-white', name: 'White', hex: '#FFFFFF' },
];

export const dashboardThemeOptions = [
    { id: 'skin-palette-blue', name: 'Blue', hex: '#3B82F6' },
    { id: 'skin-palette-indigo', name: 'Indigo', hex: '#6366F1' },
    { id: 'skin-palette-violet', name: 'Violet', hex: '#8B5CF6' },
    { id: 'skin-palette-purple', name: 'Purple', hex: '#A855F7' },
    { id: 'skin-palette-fuchsia', name: 'Fuchsia', hex: '#D946EF' },
    { id: 'skin-palette-pink', name: 'Pink', hex: '#EC4899' },
    { id: 'skin-palette-rose', name: 'Rose', hex: '#F43F5E' },
    { id: 'skin-palette-red', name: 'Red', hex: '#EF4444' },
    { id: 'skin-palette-orange', name: 'Orange', hex: '#F97316' },
    { id: 'skin-palette-amber', name: 'Amber', hex: '#F59E0B' },
    { id: 'skin-palette-yellow', name: 'Yellow', hex: '#EAB308' },
    { id: 'skin-palette-lime', name: 'Lime', hex: '#84CC16' },
    { id: 'skin-palette-emerald', name: 'Emerald', hex: '#10B981' },
    { id: 'skin-palette-teal', name: 'Teal', hex: '#14B8A6' },
    { id: 'skin-palette-cyan', name: 'Cyan', hex: '#06B6D4' },
    { id: 'skin-palette-sky', name: 'Sky', hex: '#0EA5E9' },
    { id: 'skin-palette-slate', name: 'Slate', hex: '#64748B' },
];

export const personalThemeOptions = [
    legacyThemeOptions.find(({ id }) => id === 'skin-white'),
    legacyThemeOptions.find(({ id }) => id === 'skin-black'),
    ...dashboardThemeOptions,
];

const allThemeOptions = [...legacyThemeOptions, ...dashboardThemeOptions];
const supportedThemeIds = new Set(allThemeOptions.map(({ id }) => id));
const themeHexById = Object.fromEntries(allThemeOptions.map(({ id, hex }) => [id, hex]));
const customHexPattern = /^#[0-9A-Fa-f]{6}$/;

export const isCustomThemeColor = (value) => customHexPattern.test(value || '');

export const normalizeThemePreference = (preference) =>
    supportedThemeIds.has(preference) || isCustomThemeColor(preference) ? preference : SYSTEM_THEME_ID;

export const resolveThemeColor = (preference, systemTheme = 'skin-blue') => {
    const normalizedSystemTheme = supportedThemeIds.has(systemTheme) ? systemTheme : 'skin-blue';
    return normalizeThemePreference(preference) === SYSTEM_THEME_ID ? normalizedSystemTheme : preference;
};

// Returns the `bg-skin-*` spelling every consumer compares against --
// ThemeContext strips the `bg-` prefix, while RowData, AppContent and
// AppFooter compare the whole string.
export const getThemeClass = (themeColor) => {
    const resolvedTheme = resolveThemeColor(themeColor);
    return isCustomThemeColor(resolvedTheme) ? 'bg-skin-custom' : `bg-${resolvedTheme}`;
};

export const getThemeHex = (themeClassOrId) =>
    isCustomThemeColor(themeClassOrId) ? themeClassOrId.toUpperCase() : themeHexById[themeClassOrId?.replace(/^bg-/, '')];

export const isDashboardPaletteTheme = (themeClassOrId) =>
    themeClassOrId?.replace(/^bg-/, '').startsWith('skin-palette-');

// Standard YIQ perceptual brightness formula picks a readable black/white
// foreground, then derives the rest of the palette (a "readable" darker
// accent for hover/active states, a lightened tint, and translucent
// soft/border/deep variants for tinted cards and badges) so every consumer
// reads from the same set of CSS custom properties.
export const applyThemeColor = (themeColor) => {
    if (typeof document === 'undefined') return;
    const hex = getThemeHex(themeColor);
    if (!hex) return;
    const red = parseInt(hex.slice(1, 3), 16);
    const green = parseInt(hex.slice(3, 5), 16);
    const blue = parseInt(hex.slice(5, 7), 16);
    const foreground = ((red * 299 + green * 587 + blue * 114) / 1000) >= 155 ? '#111827' : '#FFFFFF';
    const readable = ((red * 299 + green * 587 + blue * 114) / 1000) >= 145
        ? `rgb(${Math.round(red * 0.62)}, ${Math.round(green * 0.62)}, ${Math.round(blue * 0.62)})`
        : hex;
    const light = `rgb(${Math.round(red + (255 - red) * 0.5)}, ${Math.round(green + (255 - green) * 0.5)}, ${Math.round(blue + (255 - blue) * 0.5)})`;
    document.documentElement.style.setProperty('--app-theme-color', hex);
    document.documentElement.style.setProperty('--app-theme-contrast', foreground);
    document.documentElement.style.setProperty('--app-theme-readable', readable);
    document.documentElement.style.setProperty('--app-theme-light', light);
    document.documentElement.style.setProperty('--app-theme-soft', `rgba(${red}, ${green}, ${blue}, 0.10)`);
    document.documentElement.style.setProperty('--app-theme-soft-strong', `rgba(${red}, ${green}, ${blue}, 0.18)`);
    document.documentElement.style.setProperty('--app-theme-border', `rgba(${red}, ${green}, ${blue}, 0.34)`);
    document.documentElement.style.setProperty('--app-theme-deep', `rgba(${red}, ${green}, ${blue}, 0.28)`);
};

export default legacyThemeOptions;
