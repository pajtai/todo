// The theme lives in profiles.theme (the source of truth) and is mirrored to
// localStorage so the inline script in the root layout can apply it before
// the first paint, including on pages that don't load the profile.
export const THEME_STORAGE_KEY = "theme";

export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
