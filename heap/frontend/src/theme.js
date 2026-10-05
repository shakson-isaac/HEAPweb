// ---------------------------------------------------------------------------
// The HEAP design system, in one place, in two modes.
//
// "E2 cool ink": Newsreader headings, IBM Plex Sans body, teal accent, pill
// buttons, hairline panels with no shadow. Chosen 2026-10-04 from four mocked
// directions; the mockups are not in this repo -- this file is the design.
//
// LIGHT AND DARK ARE THE SAME DESIGN, NOT TWO DESIGNS. Only the six tokens
// below change: paper, panel, ink, soft ink, rule and accent. Anything that
// hard-codes a hex outside this file will survive one mode and break the other,
// so components take their colors from the theme.
//
// INTERFACE COLOR AND DATA COLOR ARE SEPARATE. `palette.primary` is the teal
// used by links, buttons, badges and active navigation. It is NOT a plot color.
// Figures keep their own palettes -- the exposure-category colors mirrored from
// plot_theme.R, and the red/blue direction colors -- so the site and the printed
// figures stay in agreement in both modes.
// ---------------------------------------------------------------------------
import { createTheme } from '@mui/material/styles';

export const SERIF = '"Newsreader", Georgia, "Times New Roman", serif';
export const SANS = '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif';
export const MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

const TOKENS = {
  light: {
    paper: '#ffffff',       // page background
    panel: '#ffffff',       // a panel on the page
    panelAlt: '#f8fafa',    // a panel that needs to separate from the page
    ink: '#111827',
    soft: '#4b5563',
    rule: '#e5e7eb',
    accent: '#0f766e',
    accentDark: '#0b5a54',
    selectedText: '#ffffff',
    // A fill and a label need different colors. The direction red and blue are
    // the manuscript's and stay on every swatch and marker; used as TEXT they
    // fall below 4.5:1, so labels take these instead.
    textUp: '#a3162a',
    textDown: '#1b5a94',
    textCausal: '#a3162a',
    textReporter: '#44525b',
    textForward: '#6a2f8c',
    textWarn: '#8a4b00',
    textOk: '#1b7837',
  },
  dark: {
    paper: '#0e1512',
    panel: '#141d1a',
    panelAlt: '#182420',
    ink: '#e8efec',
    soft: '#9fb0aa',
    rule: '#26332e',
    accent: '#5fd4bd',
    accentDark: '#7ee0cc',
    selectedText: '#06120f',
    // Lightened for a dark panel: the same meanings, legible against #141d1a.
    textUp: '#f08a94',
    textDown: '#86b7e8',
    textCausal: '#f08a94',
    textReporter: '#aebfc8',
    textForward: '#c89ae0',
    textWarn: '#f0b37a',
    textOk: '#74c994',
  },
};

const heading = (size, weight = 600, lh = 1.18, ls = '-0.4px') => ({
  fontFamily: SERIF, fontSize: size, fontWeight: weight, lineHeight: lh, letterSpacing: ls,
});

export function makeTheme(mode = 'light') {
  const t = TOKENS[mode] || TOKENS.light;
  return createTheme({
    palette: {
      mode,
      primary: { main: t.accent, dark: t.accentDark, contrastText: t.selectedText },
      secondary: { main: t.ink },
      text: { primary: t.ink, secondary: t.soft },
      background: { default: t.paper, paper: t.panel },
      divider: t.rule,
      // Named for the places that need them; read with theme.palette.heap.*
      heap: { ...t, mode },
    },
    shape: { borderRadius: 4 },
    typography: {
      fontFamily: SANS,
      fontSize: 14.5,
      h1: heading('3rem', 600, 1.06, '-1px'),
      h2: heading('2.1rem'),
      h3: heading('1.7rem'),
      h4: heading('1.55rem'),
      h5: heading('1.35rem'),
      h6: heading('1.2rem', 600, 1.25, '-0.2px'),
      subtitle1: { fontFamily: SERIF, fontSize: '1.05rem', lineHeight: 1.5 },
      subtitle2: { fontFamily: SANS, fontWeight: 600, fontSize: '0.92rem' },
      body1: { fontSize: '1rem', lineHeight: 1.62 },
      body2: { fontSize: '0.9rem', lineHeight: 1.6 },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
      caption: { fontSize: '0.8rem', lineHeight: 1.5 },
      // The uppercase label that sits over a control or a section.
      overline: {
        fontFamily: SANS, fontSize: '0.69rem', fontWeight: 600, letterSpacing: '0.1em',
        textTransform: 'uppercase', lineHeight: 1.4,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: t.paper, color: t.ink, WebkitFontSmoothing: 'antialiased' },
          a: { color: t.accent },
        },
      },
      // Pill buttons, flat. A results page never needs a raised surface.
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 999, paddingInline: 18, paddingBlock: 8 },
          outlined: {
            borderColor: t.ink,
            color: t.ink,
            '&:hover': { borderColor: t.accent, color: t.accent, background: 'transparent' },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 999, fontSize: '0.78rem', fontWeight: 500 },
          outlined: { borderColor: t.rule, color: t.soft },
          filled: { fontWeight: 600 },
        },
      },
      // Panels are a hairline, never a shadow.
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: 'none', backgroundColor: t.panel },
          outlined: { borderColor: t.rule },
        },
      },
      MuiAppBar: { defaultProps: { elevation: 0, color: 'transparent' } },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 4, fontSize: '0.88rem', border: `1px solid ${t.rule}` },
          standardInfo: { backgroundColor: t.panelAlt, color: t.ink },
          standardSuccess: { backgroundColor: mode === 'dark' ? '#14241e' : '#f0f7f4', color: t.ink },
          standardWarning: { backgroundColor: mode === 'dark' ? '#241f16' : '#fdf8ef', color: t.ink },
          standardError: { backgroundColor: mode === 'dark' ? '#271a1a' : '#fdf3f3', color: t.ink },
        },
      },
      // Segmented control: square, inked, no fill until selected.
      MuiToggleButtonGroup: { styleOverrides: { root: { borderRadius: 3 } } },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            color: t.ink,
            borderColor: t.rule,
            paddingInline: 13,
            paddingBlock: 6,
            '&.Mui-selected': {
              backgroundColor: t.ink,
              color: t.paper,
              '&:hover': { backgroundColor: t.ink, opacity: 0.9 },
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 3, backgroundColor: t.panel },
          notchedOutline: { borderColor: t.rule },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottomColor: t.rule, fontSize: '0.86rem' },
          head: {
            fontFamily: SANS, fontSize: '0.69rem', fontWeight: 600, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: t.soft, borderBottom: `1px solid ${t.ink}`,
          },
        },
      },
      MuiTabs: { styleOverrides: { indicator: { backgroundColor: t.accent, height: 2 } } },
      MuiTab: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 500, fontSize: '0.92rem', minHeight: 44 },
        },
      },
      MuiDivider: { styleOverrides: { root: { borderColor: t.rule } } },
      MuiLink: { defaultProps: { underline: 'hover' }, styleOverrides: { root: { color: t.accent } } },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { backgroundColor: t.ink, color: t.paper, fontSize: '0.78rem' },
        },
      },
    },
  });
}

export default makeTheme('light');
