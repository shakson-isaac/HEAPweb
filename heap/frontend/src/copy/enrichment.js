// Every standing sentence on /results/enrichment and its two views.
//
// This file exists so the page's prose can be rewritten without opening the
// plotting components. ExposureBodyMap.js alone is 2,234 lines and held four
// sentences; finding them meant reading plotting code.
//
// WHAT IS IN HERE: headings, subtitles, and the paragraphs a reader sees on
// arrival. Edit freely -- nothing here affects behaviour.
//
// WHAT IS NOT: state-dependent microcopy that only appears in one condition --
// empty states, load failures, per-organ tooltips ("Tested against this
// exposure, nothing at FDR q < 0.05"). Those live next to the branch that
// triggers them, because separating the words from the condition is how the
// two drift apart. Grep the exact words to find one.
//
// House style is in docs/SITE_WRITING.md. The short version for this page:
// /results/* is written for someone who knows the paper's vocabulary, a
// caption says only what the plot cannot, and caveats belong in Methods.

export const enrichmentCopy = {
  // ---- the landing page: the body map, and the ways out of it -------------
  bodyMap: {
    title: "Which tissues is this exposure's signature enriched in?",
    subtitle:
      "The body shows tissues whose expression signature this exposure's proteins are "
      + 'enriched for. Click an organ for the leading-edge proteins behind it.',
    // Sits under the pathway picker on the landing page.
    nes:
      'Positive NES means the set is enriched among proteins associated with that exposure; '
      + 'negative means depleted. Everything shown is FDR q < 0.05.',
  },

  // The two cards out of the landing page. `question` is the card's own line;
  // `payoff` is the second line, what you get by going there.
  views: {
    tissue: {
      title: 'Start from a protein or an organ',
      question: 'Where is this protein expressed, or what reaches this organ?',
      payoff: 'The same question from the other end. Two modes, one vocabulary.',
    },
    programs: {
      title: 'Programs and tissues',
      question: 'Which biological programs carry an exposure into which tissues?',
      payoff: 'Main Figure 2d, for all 114 exposures rather than the ten in print.',
    },
  },

  // ---- /results/enrichment/tissue ----------------------------------------
  tissue: {
    title: 'Start from a protein, or start from a tissue',
    subtitle:
      'The rest of this page runs one way: pick an exposure and see which tissues light up. '
      + 'These two views run the other way — from a protein to where its gene is transcribed, '
      + 'and from a tissue to the exposures whose proteins concentrate in it.',
  },

  // ---- /results/enrichment/programs --------------------------------------
  programs: {
    title: 'Exposure → biological program → tissue, for any exposure',
    subtitle:
      'Main Figure 2d routes ten curated exemplar exposures through the biological program '
      + 'clusters to organ systems. The enrichment behind it was never narrowed to those ten — '
      + 'this is the same panel, drawn for any of the 114 exposures, so the reader can ask why '
      + 'the exemplars were the exemplars. All edges are FDR q < 0.05.',
    // Under the figure. The backbone not moving with the picker is the thing
    // readers ask about first.
    backbone:
      'The gray backbone is a study-wide count across all 114 exposures, so it does not '
      + "change with the picker. The selected exposure's own tissue signal is the badge "
      + 'grid on the right.',
  },
};

export default enrichmentCopy;
