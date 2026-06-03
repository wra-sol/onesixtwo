#!/usr/bin/env Rscript
# Exports Lahman RData tables to CSV for the Node build pipeline.
args <- commandArgs(trailingOnly = TRUE)
data_dir <- if (length(args) >= 1) args[1] else file.path("data", "lahman", "source")
out_dir <- if (length(args) >= 2) args[2] else file.path("data", "lahman")

dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

tables <- c(
  "People",
  "Batting",
  "Pitching",
  "Fielding",
  "TeamsFranchises",
  "Appearances"
)

for (name in tables) {
  path <- file.path(data_dir, paste0(name, ".RData"))
  if (!file.exists(path)) {
    stop(paste("Missing", path))
  }
  load(path)
  obj <- get(name)
  out <- file.path(out_dir, paste0(name, ".csv"))
  write.csv(obj, out, row.names = FALSE, na = "")
  message(paste("Wrote", out, "rows:", nrow(obj)))
}
