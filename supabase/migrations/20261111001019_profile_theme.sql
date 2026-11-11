-- Light or dark mode, chosen with the toggle in the header. Null follows the
-- device's setting until the user picks one.
alter table public.profiles
  add column theme text
    constraint profiles_theme_check check (theme in ('light', 'dark'));
