# Within-person PES tracking, aggregated for the web.
#
# The site's two tracking views are both one point per exposure: a scatter of
# 132 dots. Neither shows the thing Figure 6c shows -- for ONE exposure, how
# the score moves when that exposure moves. This builds that, for every
# exposure and every visit pairing, as aggregates only.
#
# Recipe follows fig_m6_panel_c.R: holdout scores, pes_prot_z, y_raw.
#
# WHY EXPLICIT PAIRINGS. The manuscript panel pools instance 2 and 3 against
# baseline, so a person contributing both visits is counted twice and n is
# visit-pairs, not people. Each pairing here is one row per eid, so n IS
# people and the two numbers stop disagreeing.
#
# DISCLOSURE. Only band means, SEs and counts are written; no eid ever leaves
# this script, and a band holding fewer than MIN people is dropped, not shown.

suppressPackageStartupMessages({library(data.table)})

OD   <- "/n/groups/patel/IGLOO/UKB/HEAP/output/module6_pes_longitudinal/base"
OUT  <- "/n/groups/patel/shakson_ukb/HEAPweb/build/derived"
MIN  <- 10          # same floor audit_payload.py enforces
ORD  <- 12          # <= this many distinct values counts as ordinal

PAIRS <- list(c(0, 2, "10y"), c(2, 3, "2y"), c(0, 3, "12y"))

meta <- tryCatch({
  j <- jsonlite::fromJSON("/n/groups/patel/IGLOO/UKB/HEAP/figures/website/fig_pes_within_person_change.json")
  as.data.table(j)[, .(exposure_id, exposure_label, category)]
}, error = function(e) NULL)

files <- list.files(OD, "HoldoutScores\\.tsv$", full.names = TRUE)
cat(sprintf("scanning %d exposures x %d pairings\n", length(files), length(PAIRS)))

bands <- list(); heads <- list()

for (f in files) {
  h <- fread(f, showProgress = FALSE)
  eid_col <- "eid"
  ex   <- h$exposure_id[1]
  type <- h$exposure_type[1]
  # baseline spread, for SD-scaled bands on genuinely continuous exposures
  b0   <- h[instance == 0]
  nuq  <- uniqueN(b0$y_raw[is.finite(b0$y_raw)])
  sd0  <- sd(b0$y_raw, na.rm = TRUE)

  for (P in PAIRS) {
    i0 <- as.integer(P[1]); i1 <- as.integer(P[2]); ts <- P[3]
    a <- h[instance == i0, .(eid, y0 = y_raw, s0 = pes_prot_z)]
    b <- h[instance == i1, .(eid, y1 = y_raw, s1 = pes_prot_z)]
    m <- merge(a, b, by = "eid")
    m <- m[is.finite(y0) & is.finite(y1) & is.finite(s0) & is.finite(s1)]
    if (nrow(m) < MIN) next
    m[, `:=`(dY = y1 - y0, dS = s1 - s0)]

    # n_changed is itself a cell count, and a correlation resting on a handful
    # of movers is both disclosive and uninformative. Drop the row, do not
    # merely blank the count -- audit_payload.py checks every numeric field.
    if (sum(m$dY != 0) < MIN) next

    ct <- tryCatch(cor.test(m$dY, m$dS), error = function(e) NULL)
    heads[[length(heads) + 1]] <- data.table(
      exposure_id = ex, exposure_type = type, timescale = ts,
      n_people = nrow(m), n_changed = sum(m$dY != 0),
      r  = if (is.null(ct)) NA_real_ else unname(ct$estimate),
      lo = if (is.null(ct)) NA_real_ else ct$conf.int[1],
      hi = if (is.null(ct)) NA_real_ else ct$conf.int[2])

    if (type == "binary") {
      # A binary exposure has no dose. What it has is a transition, which is
      # how the manuscript shows it: state at t0 -> state at t1.
      m[, band := paste0(ifelse(y0 > 0, "Yes", "No"), " → ",
                         ifelse(y1 > 0, "Yes", "No"))]
      m[, band_order := (y0 > 0) * 2 + (y1 > 0) + 1]
      mode <- "transition"
    } else if (nuq <= ORD) {
      # Ordinal: a one-category move is the unit people think in.
      m[, k := pmax(-3, pmin(3, round(dY)))]
      m[, band := fifelse(k <= -3, "≤ -3", fifelse(k >= 3, "≥ +3",
                    fifelse(k > 0, paste0("+", k), as.character(k))))]
      m[, band_order := k + 4]
      mode <- "ordinal"
    } else {
      # Continuous: SD units of the baseline spread, so bands mean the same
      # thing across exposures measured on different scales.
      if (!is.finite(sd0) || sd0 == 0) next
      m[, z := dY / sd0]
      m[, k := fifelse(z <= -1.5, -2L, fifelse(z <= -0.5, -1L,
              fifelse(z < 0.5, 0L, fifelse(z < 1.5, 1L, 2L))))]
      m[, band := c("≤ -1.5", "-1.5 to -0.5", "-0.5 to +0.5",
                    "+0.5 to +1.5", "≥ +1.5")[k + 3]]
      m[, band_order := k + 3]
      mode <- "sd"
    }

    g <- m[, .(n = .N, mean_dscore = mean(dS), se = sd(dS) / sqrt(.N)),
           by = .(band, band_order)][order(band_order)]
    g <- g[n >= MIN]                       # disclosure floor
    if (!nrow(g)) next
    g[, `:=`(exposure_id = ex, exposure_type = type, timescale = ts,
             band_mode = mode,
             lo = mean_dscore - 1.96 * se, hi = mean_dscore + 1.96 * se)]
    bands[[length(bands) + 1]] <- g
  }
}

B <- rbindlist(bands); H <- rbindlist(heads)
if (!is.null(meta)) {
  B <- merge(B, meta, by = "exposure_id", all.x = TRUE)
  H <- merge(H, meta, by = "exposure_id", all.x = TRUE)
}
B[is.na(exposure_label), exposure_label := exposure_id]
H[is.na(exposure_label), exposure_label := exposure_id]
num <- c("mean_dscore","se","lo","hi"); B[, (num) := lapply(.SD, round, 4), .SDcols = num]
num <- c("r","lo","hi");                H[, (num) := lapply(.SD, round, 4), .SDcols = num]

dir.create(OUT, showWarnings = FALSE, recursive = TRUE)
setcolorder(B, c("exposure_id","exposure_label","category","exposure_type",
                 "timescale","band_mode","band_order","band","n",
                 "mean_dscore","se","lo","hi"))
fwrite(B, file.path(OUT, "pes_track_bands.tsv"), sep = "\t")
fwrite(H, file.path(OUT, "pes_track_headline.tsv"), sep = "\t")

cat(sprintf("\n  bands    %d rows, %d exposures, %d timescales\n",
            nrow(B), uniqueN(B$exposure_id), uniqueN(B$timescale)))
cat(sprintf("  headline %d rows\n", nrow(H)))
cat(sprintf("  smallest band n = %d (floor %d)\n", min(B$n), MIN))
print(B[, .N, by = .(band_mode)])
