# Theme (light and dark mode)

The header's ☾/☀ button (`src/app/(app)/theme-toggle.tsx`) switches between light and dark mode and saves the choice to `profiles.theme` with the `saveTheme` action. Until the user picks one, `theme` is null and the device's setting (`prefers-color-scheme`) decides.

## Applying it without a flash

The profile can only be read inside `<Suspense>` (see [auth.md](auth.md#cache-components)), but `<html>` can't wait for it. So the choice is mirrored to `localStorage` under `theme`, and an inline script in the root layout (`THEME_SCRIPT` in `src/lib/theme.ts`) copies it to `<html data-theme>` before the first paint. `<html>` has `suppressHydrationWarning` because of that.

The database is the source of truth: when the header loads, the toggle writes the saved value to the attribute and `localStorage` (or clears both when it's null). This brings a new device in line and replaces a choice another account left in the same browser. Signed-out pages (login, sign-up) use whatever this browser last had.

## Styling

`src/app/globals.css` redefines Tailwind's gray, black, white, and two red palette variables with `light-dark()`. `color-scheme` picks the side: `light dark` by default (follow the device), forced by `[data-theme="light"]` or `[data-theme="dark"]`. So components keep using `text-gray-500`, `border-gray-300`, `bg-black text-white`, and so on, with no `dark:` classes:

- The gray scale flips (fills and borders darken, text lightens).
- `black` is the ink color and `white` the page color, so black buttons turn light with dark text, and `bg-white` fills match the page.
- `red-600` (errors) lightens; `red-300` (missed habit days) darkens.

Using a color outside those palettes? Add its dark value in `globals.css`, or it stays the same in both modes. Category colors are user-picked and stay as-is.
