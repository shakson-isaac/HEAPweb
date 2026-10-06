// ---------------------------------------------------------------------------
// The site renders in light only.
//
// It used to follow `prefers-color-scheme`, so a visitor with Dark Mode on got
// a dark site with no way to opt out. That was turned off on 2026-10-06 after
// reader feedback: the dark rendering was not helping people read the results.
//
// The mechanism is kept rather than deleted, because this is a presentation
// decision that may be revisited. `theme.js` still carries a full set of dark
// tokens and every component still reads its colors from the theme, so
// restoring it means changing MODE below back to the system query -- nothing
// else. Leaving the plumbing in place is what keeps that true.
// ---------------------------------------------------------------------------
import React, { createContext, useContext, useMemo } from 'react';

const MODE = 'light';

const ColorModeContext = createContext({ mode: MODE });

export function ColorModeProvider({ children }) {
  const value = useMemo(() => ({ mode: MODE }), []);
  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}

export function useColorMode() {
  return useContext(ColorModeContext);
}

export default ColorModeContext;
