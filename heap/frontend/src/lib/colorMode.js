// ---------------------------------------------------------------------------
// Light or dark, decided by the visitor's own device.
//
// There is no switch on this site. The mode comes from `prefers-color-scheme`,
// which Safari, Chrome, Firefox and Edge all report from the operating system
// setting, and it follows a change made mid-visit -- turn on Dark Mode in macOS
// and the open tab flips with it.
//
// Nothing is stored. A site that remembers a choice has to offer one; without a
// switch there is nothing to remember, and no state that can disagree with the
// system.
//
// matchMedia can throw in hardened privacy settings, so every call is wrapped.
// A failure means light.
// ---------------------------------------------------------------------------
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const MQ = '(prefers-color-scheme: dark)';

function systemMode() {
  try { return window.matchMedia(MQ).matches ? 'dark' : 'light'; } catch { return 'light'; }
}

const ColorModeContext = createContext({ mode: 'light' });

export function ColorModeProvider({ children }) {
  const [mode, setMode] = useState(systemMode);

  useEffect(() => {
    let mql;
    try { mql = window.matchMedia(MQ); } catch { return undefined; }
    const onChange = (e) => setMode(e.matches ? 'dark' : 'light');
    // Safari below 14 only has the deprecated addListener.
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else if (mql.addListener) mql.addListener(onChange);
    return () => {
      if (!mql) return;
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else if (mql.removeListener) mql.removeListener(onChange);
    };
  }, []);

  const value = useMemo(() => ({ mode }), [mode]);
  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}

export function useColorMode() {
  return useContext(ColorModeContext);
}

export default ColorModeContext;
