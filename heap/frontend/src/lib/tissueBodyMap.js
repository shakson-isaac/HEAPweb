// ---------------------------------------------------------------------------
// GTEx tissue -> anatomogram region.
//
// Written by hand, one line per tissue, because it does not normalize. GTEx and
// EBI's anatomogram both name anatomy but in opposite word order and different
// granularity: artery_coronary -> coronary_artery, breast_mammary_tissue ->
// breast, brain_amygdala -> amygdala. An automatic string match recovered 19 of
// these 51; the rest are judgement, so each is stated rather than derived.
//
// `view` says WHICH vendored SVG carries the shape:
//   'body'  homo_sapiens.male.svg / .female.svg  (the sex toggle picks one)
//   'brain' homo_sapiens.brain.svg               (the 14 brain subregions)
//   null    no body location, ever -- see NON_ANATOMICAL below
//
// `sex` marks shapes that exist in only one body SVG. GTEx assays testis,
// prostate, ovary, uterus, cervix, fallopian tube and vagina, so whichever
// figure is on screen, some enriched tissue may have nowhere to sit. Those are
// shown in the side panel rather than dropped -- an enrichment that exists
// should not disappear because of which body is being drawn.
//
// THE TWO BODY SVGs ARE NOT SYMMETRIC, and verifying a region against
// "male or female" hides it. Confirmed on the vendored files: the female SVG
// has no `spinal_cord` shape at all, and spells the coronary artery with a
// SPACE (`coronary artery`) where the male uses an underscore. So a region id
// must be resolved against the figure actually on screen, and a component that
// cannot find one should route that tissue to the side panel rather than fail
// to paint it. Measured: male resolves 26 of 32 body regions (missing the six
// female-specific), female 30 of 32 (missing testis and spinal cord).
//
// Several tissues collapse onto one shape: the anatomogram has a single
// `adipose_tissue`, `skin`, `kidney`/`renal_cortex` and `colon`, where GTEx has
// two or more each. That is a real loss of resolution and the component says so
// on hover rather than silently painting the same organ twice.
// ---------------------------------------------------------------------------

export const TISSUE_BODY_MAP = {
  // --- trunk and viscera ---------------------------------------------------
  adipose_subcutaneous: { region: 'adipose_tissue', view: 'body' },
  adipose_visceral_omentum: { region: 'adipose_tissue', view: 'body' },
  adrenal_gland: { region: 'adrenal_gland', view: 'body' },
  liver: { region: 'liver', view: 'body' },
  lung: { region: 'lung', view: 'body' },
  pancreas: { region: 'pancreas', view: 'body' },
  spleen: { region: 'spleen', view: 'body' },
  stomach: { region: 'stomach', view: 'body' },
  thyroid: { region: 'thyroid_gland', view: 'body' },
  kidney_cortex: { region: 'renal_cortex', view: 'body' },
  // The anatomogram draws no medulla; it shares the kidney shape with the
  // cortex, so the two GTEx kidney tissues paint the same organ.
  kidney_medulla: { region: 'kidney', view: 'body' },

  // --- gut -----------------------------------------------------------------
  colon_sigmoid: { region: 'colon', view: 'body' },
  colon_transverse: { region: 'colon', view: 'body' },
  small_intestine_terminal_ileum: { region: 'ileum', view: 'body' },
  esophagus_mucosa: { region: 'esophagus', view: 'body' },
  esophagus_muscularis: { region: 'esophagus', view: 'body' },
  minor_salivary_gland: { region: 'salivary_gland', view: 'body' },

  // --- heart and vessels ---------------------------------------------------
  heart_atrial_appendage: { region: 'atrial_appendage', view: 'body' },
  heart_left_ventricle: { region: 'left_ventricle', view: 'body' },
  artery_aorta: { region: 'aorta', view: 'body' },
  artery_coronary: { region: 'coronary_artery', view: 'body' },
  // No tibial artery shape exists; the generic arterial vessel is the closest
  // honest target, and the hover says the anatomogram cannot place it exactly.
  artery_tibial: { region: 'aorta', view: 'body', approximate: true },

  // --- skin, muscle, nerve -------------------------------------------------
  skin_not_sun_exposed_suprapubic: { region: 'skin', view: 'body' },
  skin_sun_exposed_lower_leg: { region: 'skin', view: 'body' },
  muscle_skeletal: { region: 'skeletal_muscle', view: 'body' },
  nerve_tibial: { region: 'nerve', view: 'body' },
  breast_mammary_tissue: { region: 'breast', view: 'body' },

  // --- sex-specific: present in only one of the two body SVGs --------------
  testis: { region: 'testis', view: 'body', sex: 'male' },
  ovary: { region: 'ovary', view: 'body', sex: 'female' },
  uterus: { region: 'uterus', view: 'body', sex: 'female' },
  vagina: { region: 'vagina', view: 'body', sex: 'female' },
  fallopian_tube: { region: 'fallopian_tube', view: 'body', sex: 'female' },
  cervix_ectocervix: { region: 'ectocervix', view: 'body', sex: 'female' },
  // The anatomogram has no endocervix shape; uterine_cervix is the containing
  // structure, so the two cervical tissues cannot be told apart on the body.
  cervix_endocervix: { region: 'uterine_cervix', view: 'body', sex: 'female' },

  // --- brain: its own SVG --------------------------------------------------
  brain_amygdala: { region: 'amygdala', view: 'brain' },
  brain_anterior_cingulate_cortex_ba24: { region: 'cingulate_cortex', view: 'brain' },
  brain_caudate_basal_ganglia: { region: 'caudate_nucleus', view: 'brain' },
  brain_cerebellar_hemisphere: { region: 'cerebellar_hemisphere', view: 'brain' },
  brain_cerebellum: { region: 'cerebellum', view: 'brain' },
  brain_cortex: { region: 'cerebral_cortex', view: 'brain' },
  brain_frontal_cortex_ba9: { region: 'frontal_cortex', view: 'brain' },
  brain_hippocampus: { region: 'hippocampus', view: 'brain' },
  brain_hypothalamus: { region: 'hypothalamus', view: 'brain' },
  brain_nucleus_accumbens_basal_ganglia: { region: 'nucleus_accumbens', view: 'brain' },
  brain_putamen_basal_ganglia: { region: 'putamen', view: 'brain' },
  brain_substantia_nigra: { region: 'substantia_nigra', view: 'brain' },
  'brain_spinal_cord_cervical_c-1': { region: 'spinal_cord', view: 'body' },
  pituitary: { region: 'pituitary_gland', view: 'body' },
};

// Not places. Two are cell lines and one is a fluid, so no anatomogram shape
// can be right. They are listed beside the figure and highlight the same way,
// which keeps them visible instead of quietly absent from an "all tissues" view.
export const NON_ANATOMICAL = {
  whole_blood: 'whole blood — a fluid, not a location',
  'cells_ebv-transformed_lymphocytes': 'EBV-transformed lymphocytes — a cell line',
  cells_cultured_fibroblasts: 'cultured fibroblasts — a cell line',
};

/** Tissues that share one anatomogram shape, so a highlight is ambiguous. */
export const SHARED_REGIONS = Object.entries(TISSUE_BODY_MAP)
  .reduce((acc, [tissue, m]) => {
    (acc[m.region] ||= []).push(tissue);
    return acc;
  }, {});

/** "brain_frontal_cortex_ba9" -> "Brain frontal cortex BA9" */
export const prettyTissue = (t) => {
  const s = String(t).replace(/_/g, ' ').replace(/\bba(\d+)\b/i, 'BA$1');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
