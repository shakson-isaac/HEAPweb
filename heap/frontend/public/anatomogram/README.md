# Anatomogram SVGs

Vendored from **EBI Expression Atlas** — `@ebi-gene-expression-group/anatomogram`
v2.4.0, **Apache-2.0**, https://github.com/gxa/anatomogram

    homo_sapiens.male.svg     932K
    homo_sapiens.female.svg   420K
    homo_sapiens.brain.svg    348K

## Why vendored rather than installed

The npm package is a React component built for Expression Atlas's own heatmap.
We want the SVGs, not its rendering: HEAP highlights organs by enrichment
direction and magnitude, which means owning the fill logic rather than fighting
someone else's. Apache-2.0 permits redistribution with attribution, which this
file is.

Vendoring also pins them. An anatomogram that silently changed shape under a
dependency bump would move every organ on the body map without anything in this
repo changing.

## How they are keyed

Every organ is an addressable SVG `id`, so highlighting is a fill on a selector.
There are ~116 named anatomical regions (`liver`, `lung`, `coronary_artery`,
`skeletal_muscle`, `adipose_tissue`, ...) plus ~76 UBERON-keyed shapes.

The vocabulary is close to GTEx's because Expression Atlas indexes GTEx — but it
is NOT identical, and the difference does not normalize away by string rules.
`artery_coronary` -> `coronary_artery`, `breast_mammary_tissue` -> `breast`,
`brain_amygdala` -> `amygdala`. Automatic matching recovered only 19 of our 51
tissues; the rest need the explicit map that lives with the body-map component,
written by hand so each pairing is deliberate.

Three GTEx tissues have no body location at all and never will:
`cells_ebv-transformed_lymphocytes` and `cells_cultured_fibroblasts` are cell
lines, and `whole_blood` is not a place. They belong in the side panel, lit the
same way but never drawn on the body.
