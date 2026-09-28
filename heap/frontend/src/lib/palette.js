// Exposure category colors, copied from HEAP's single source of truth:
// scripts/visualizations/common/plot_theme.R :: HEAP_ECAT_COLORS.
// Keep in sync with that file so the site and the manuscript figures agree.
export const ECAT_COLORS = {
  Alcohol: '#D55E00',
  Smoking: '#444444',
  Vitamins: '#E69F00',
  Diet_Weekly: '#009E73',
  Exercise_Freq: '#117733',
  Exercise_MET: '#44AA99',
  Internet_Usage: '#CC79A7',
  Sleep: '#0072B2',
  Sexual_Factors: '#AA4499',
  Sun_Exposure: '#DDCC77',
  Residential_Air_Pollution: '#882255',
  Residential_Noise_Pollution: '#999933',
  Deprivation_Indices: '#56B4E9',
  Other: '#BDBDBD',
};

export const ecatColor = (c) => ECAT_COLORS[c] || ECAT_COLORS.Other;

/**
 * "pack_years_of_smoking_f20161_0_0"              -> "Pack years of smoking"
 * "alcohol_drinker_status_f20117_0_0_Current"     -> "Alcohol drinker status: Current"
 * "vitamin_and_mineral_supplements_f6155_0_0.multi_Vitamin_A"
 *                                                 -> "Vitamin and mineral supplements: Vitamin A"
 *
 * The level after the UK Biobank field code is part of the identity, not noise.
 * Cutting everything after `_f<field>_0_0` collapsed 82 of 167 exposures into 20
 * labels -- "Vitamin and mineral supplements" alone named seven different
 * exposures, among them "Vitamin A" and "None of the above". Any table or
 * legend keyed on the label then merged exposures that are not the same thing.
 */
export const prettyExposure = (x) => {
  // Accepts a raw id ("..._f6179_0_0.multi_Calcium") and also the half-cleaned
  // form some sections already store ("... f6179 0 0.multi Calcium"), where an
  // earlier pass replaced the underscores but left the field code in. Handling
  // both means one function fixes the label wherever it is displayed, instead
  // of each page carrying its own repair.
  const raw = String(x).replace(/\s+/g, '_');
  const m = raw.match(/_f\d+_\d+_\d+\.?(?:multi)?_?(.*)$/);
  const stem = raw.replace(/_f\d+_\d+_\d+.*$/, '').replace(/_/g, ' ');
  const head = stem.replace(/^\w/, (c) => c.toUpperCase());
  const level = m && m[1]
    ? m[1].replace(/_/g, ' ').replace(/\.+/g, ' ').replace(/\s+/g, ' ').trim()
    : '';
  return level ? `${head}: ${level}` : head;
};

export const prettyCategory = (c) => String(c).replace(/_/g, ' ');

/**
 * UK Biobank first-occurrence field -> the ICD-10 rubric in words.
 *   age_e78_first_reported_disorders_of_lipoprotein_metabolism..._f130814_0_0
 *   -> "Disorders of lipoprotein metabolism and other lipidaemias"
 *
 * Not an approximation: checked against the 170 authoritative `disease_label`
 * values in the supplementary deposit's PES disease lookup, this reproduces all
 * 170 exactly. That is why there is no code map to maintain -- the field name
 * IS the label, spelled with underscores.
 *
 * `fallback` is used when no UK Biobank field is available, e.g. a FinnGen
 * endpoint id, which is opaque and only gets its underscores cleaned up.
 */
export const prettyDisease = (fallback, ukbField) => {
  if (ukbField) {
    const s = String(ukbField)
      .replace(/^age_/, '')
      .replace(/_f\d+.*$/, '')
      .replace(/^[a-z]\d+[a-z0-9]*_/, '')
      .replace(/^first_reported_/, '')
      .replace(/_/g, ' ');
    if (s) return s.replace(/^\w/, (c) => c.toUpperCase());
  }
  return String(fallback).replace(/^finngen_R12_/, '').replace(/_/g, ' ');
};

// Model-component colors, mirroring HEAP_PAL_COMPONENT in plot_theme.R.
// Entries marked EXTENSION have no counterpart there and exist only because the
// site plots sub-blocks the R palette does not name; keep them visually
// consistent with their parent component.
export const COMP_COLORS = {
  Covars: '#9E9E9E', Covariates: '#9E9E9E', C: '#9E9E9E',
  Genetic: '#1B6CA8', G: '#1B6CA8', PGS: '#1B6CA8',
  Exposome: '#2E9E48', Exposomic: '#2E9E48', E: '#2E9E48', PXS: '#2E9E48',
  GxE: '#7B3FA0', Interaction: '#7B3FA0',
  Residual: '#D9D9D9',
  cis: '#1B6CA8',      // EXTENSION - genetic sub-block
  trans: '#6BAED6',    // EXTENSION - genetic sub-block, lighter
  Total: '#444444',    // EXTENSION - whole-model total
};

export const compColor = (c) => COMP_COLORS[c] || COMP_COLORS.Residual;

// MR motif colors, mirroring COL in
// HEAP/scripts/visualizations/build_mr_panelb_folded.R:26 (main Fig 4b) so the
// site and the paper name each motif with the same color.
export const MOTIF_COLORS = {
  A: '#1A6B30',   // mediator
  B: '#2C7FB8',   // biomarker
  C: '#3FA66A',   // exposure-marker
  D: '#9E77B0',   // protein -> exposure
  E: '#D95F0E',   // disease-liability
};

export const motifColor = (m) => MOTIF_COLORS[String(m).charAt(0)] || '#78909C';
