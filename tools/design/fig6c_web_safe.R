suppressPackageStartupMessages({library(data.table); library(ggplot2); library(patchwork)})
od <- "/n/groups/patel/IGLOO/UKB/HEAP/output/module6_pes_longitudinal/base"
MIN <- 10; GREEN <- "#1B7837"; BLUE <- "#0072B2"; RED <- "#B2182B"; GREY <- "grey60"

# The manuscript recipe, unchanged: fig_m6_panel_c.R uses the IMAGING visits
# (instance 2 and 3) against baseline, and the z-scored score pes_prot_z.
pair <- function(e) {
  h <- fread(file.path(od, sprintf("PESlong_base_%s_HoldoutScores.tsv", e)))
  b <- h[instance == 0, .(eid, y0 = y_raw, p0 = pes_prot_z)]
  f <- h[instance %in% c(2, 3), .(eid, y1 = y_raw, p1 = pes_prot_z)]
  merge(f, b, by = "eid")
}

# ---------- alcohol: binned means, manuscript r -----------------------------
a <- pair("alcohol_intake_frequency_f1558_0_0")[, `:=`(dY = y1-y0, dP = p1-p0)]
a <- a[is.finite(dY) & is.finite(dP)]
ct <- cor.test(a$dY, a$dP)
a[, band := cut(dY, c(-Inf,-2.5,-1.5,-0.5,0.5,1.5,2.5,Inf),
                labels = c("≤ -3","-2","-1","0","+1","+2","≥ +3"))]
agg <- a[, .(m = mean(dP), se = sd(dP)/sqrt(.N), n = .N, ppl = uniqueN(eid)), by = band][order(band)][n >= MIN]
cat(sprintf("  alcohol r = %.2f [%.2f, %.2f] · %d pairs from %d people\n",
            ct$estimate, ct$conf.int[1], ct$conf.int[2], nrow(a), uniqueN(a$eid)))
print(agg)
agg[, xn := as.numeric(band)]
pA <- ggplot(agg, aes(xn, m)) +
  geom_hline(yintercept = 0, linetype = 2, colour = "grey70", linewidth = .35) +
  geom_line(colour = GREEN, linewidth = .8) +
  geom_ribbon(aes(ymin = m-1.96*se, ymax = m+1.96*se), fill = GREEN, alpha = .2) +
  geom_point(colour = GREEN, size = 2.2) +
  geom_text(aes(label = n, y = m + 1.96*se), vjust = -0.9, size = 2.2, colour = "grey45") +
  annotate("text", x = min(agg$xn), y = max(agg$m + 1.96*agg$se), hjust = 0, vjust = -1.4,
           label = sprintf("r = %.2f  [%.2f, %.2f]", ct$estimate, ct$conf.int[1], ct$conf.int[2]),
           colour = GREEN, fontface = "bold", size = 3.3) +
  scale_x_continuous(breaks = agg$xn, labels = as.character(agg$band)) +
  coord_cartesian(clip = "off") +
  labs(title = "Alcohol dose",
       subtitle = sprintf("%s visit-pairs from %s people · numbers on each point are pairs",
                          format(nrow(a), big.mark=","), format(uniqueN(a$eid), big.mark=",")),
       x = "Δ drinking", y = "Δ score (z)") +
  theme_minimal(base_size = 10) +
  theme(plot.title = element_text(face="bold"), panel.grid.minor = element_blank(),
        plot.margin = margin(16,8,6,6))

# ---------- smoking: paired group means, manuscript grouping ----------------
s <- pair("smoking_status_f20116_0_0_Current")
s[, grp := fcase(y0==1 & y1==0, "Quit", y0==0 & y1==1, "Started",
                 y0==1 & y1==1, "Smoker", y0==0 & y1==0, "Non-smoker")]
cts <- cor.test(s$y1-s$y0, s$p1-s$p0)
g <- melt(s[!is.na(grp), .(eid, grp, Baseline = p0, `Follow-up` = p1)],
          id.vars = c("eid","grp"), variable.name = "visit", value.name = "score")
ag <- g[, .(m = mean(score), se = sd(score)/sqrt(.N), n = .N, ppl = uniqueN(eid)),
        by = .(grp, visit)][n >= MIN]
print(ag)
cols <- c(Quit = BLUE, Started = RED, `Non-smoker` = GREY, Smoker = "grey35")
pB <- ggplot(ag, aes(visit, m, colour = grp, group = grp)) +
  geom_ribbon(aes(ymin = m-1.96*se, ymax = m+1.96*se, fill = grp), alpha = .18, colour = NA) +
  geom_line(linewidth = .9) + geom_point(size = 2.2) +
  geom_text(data = ag[visit == "Follow-up"],
            aes(label = sprintf("%s  (%d pairs, %d people)", grp, n, ppl)),
            hjust = -0.06, size = 2.5, show.legend = FALSE) +
  annotate("text", x = 0.6, y = max(ag$m), hjust = 0, vjust = -1.2,
           label = sprintf("r = %.2f  [%.2f, %.2f]", cts$estimate, cts$conf.int[1], cts$conf.int[2]),
           colour = "grey25", fontface = "bold", size = 3.3) +
  scale_colour_manual(values = cols, guide = "none") +
  scale_fill_manual(values = cols, guide = "none") +
  coord_cartesian(clip = "off") +
  labs(title = "Smoking reversibility",
       subtitle = "group means with 95% CI — no individual trajectories",
       x = NULL, y = "Score (z)") +
  theme_minimal(base_size = 10) +
  theme(plot.title = element_text(face="bold"), panel.grid.minor = element_blank(),
        plot.margin = margin(16, 108, 6, 6))

ggsave("/tmp/shi872/final6c.png", (pA | pB), width = 11.6, height = 4.3, dpi = 150)
cat("  saved\n")
