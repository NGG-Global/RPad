/**
 * R code evaluated once after WebR starts. It defines helper functions used by
 * RPad for environment inspection, data frame paging, file listing and the
 * View() bridge. Everything lives in a dedicated environment attached to the
 * search path as "rpad" so user objects in the global environment are never
 * touched. All displayed data is produced by these R functions, not by JS.
 */
export const R_PRELUDE = String.raw`
local({
  rpad <- new.env()
  rpad$views <- list()
  rpad$pending_views <- character(0)
  rpad$plot_size <- c(672, 448)

  rpad$cell_text <- function(x) {
    na <- is.na(x)
    txt <- if (is.factor(x)) as.character(x)
      else if (inherits(x, "Date") || inherits(x, "POSIXt")) format(x)
      else if (is.numeric(x)) format(x, digits = 7, trim = TRUE, scientific = FALSE, drop0trailing = TRUE)
      else if (is.list(x)) vapply(x, function(v) paste(format(v), collapse = ", "), character(1))
      else as.character(x)
    txt[na] <- NA_character_
    txt
  }

  rpad$preview <- function(x) {
    tryCatch({
      if (is.data.frame(x)) paste(names(x), collapse = ", ")
      else if (is.function(x)) paste(deparse(args(x))[1], collapse = "")
      else if (is.factor(x)) paste0("levels: ", paste(head(levels(x), 6), collapse = ", "), if (nlevels(x) > 6) " ..." else "")
      else if (is.matrix(x)) paste(format(head(as.vector(x), 8)), collapse = " ")
      else if (is.atomic(x)) { s <- paste(format(head(x, 8)), collapse = " "); if (length(x) > 8) paste(s, "...") else s }
      else if (is.list(x)) paste0("list of ", length(x), if (!is.null(names(x))) paste0(": ", paste(head(names(x), 6), collapse = ", ")) else "")
      else paste(class(x), collapse = "/")
    }, error = function(e) "")
  }

  rpad$env_summary <- function(envir = globalenv()) {
    nms <- ls(envir)
    n <- length(nms)
    out <- list(name = character(n), class = character(n), type = character(n), dims = character(n),
                nrow = rep(NA_real_, n), ncol = rep(NA_real_, n), length = rep(NA_real_, n),
                preview = character(n), is_df = logical(n), is_fn = logical(n))
    for (i in seq_len(n)) {
      x <- get(nms[i], envir = envir)
      d <- dim(x)
      out$name[i] <- nms[i]
      out$class[i] <- paste(class(x), collapse = "/")
      out$type[i] <- typeof(x)
      out$is_df[i] <- is.data.frame(x)
      out$is_fn[i] <- is.function(x)
      if (!is.null(d) && length(d) == 2) {
        out$nrow[i] <- d[1]; out$ncol[i] <- d[2]
        out$dims[i] <- paste0(d[1], " × ", d[2])
      } else if (is.function(x)) {
        out$dims[i] <- "function"
      } else {
        out$length[i] <- length(x)
        out$dims[i] <- paste0("[", length(x), "]")
      }
      out$preview[i] <- substr(rpad$preview(x), 1, 160)
    }
    out
  }

  rpad$resolve <- function(ref_kind, ref_name) {
    if (identical(ref_kind, "view")) rpad$views[[ref_name]] else get(ref_name, envir = globalenv())
  }

  rpad$df_meta <- function(ref_kind, ref_name) {
    x <- rpad$resolve(ref_kind, ref_name)
    if (is.matrix(x)) x <- as.data.frame(x)
    if (!is.data.frame(x)) stop("not a data frame")
    cls <- vapply(x, function(col) paste(class(col), collapse = "/"), character(1))
    lv <- lapply(x, function(col) if (is.factor(col)) levels(col) else character(0))
    list(nrow = nrow(x), ncol = ncol(x), names = names(x), classes = unname(cls), levels = unname(lv))
  }

  rpad$df_page <- function(ref_kind, ref_name, offset, limit, sort_col, sort_desc, filter) {
    x <- rpad$resolve(ref_kind, ref_name)
    if (is.matrix(x)) x <- as.data.frame(x)
    if (!is.data.frame(x)) stop("not a data frame")
    idx <- seq_len(nrow(x))
    if (nzchar(filter)) {
      keep <- rep(FALSE, nrow(x))
      for (col in x) {
        txt <- rpad$cell_text(col)
        keep <- keep | (!is.na(txt) & grepl(filter, txt, fixed = TRUE, ignore.case = TRUE))
      }
      idx <- idx[keep]
    }
    if (nzchar(sort_col) && sort_col %in% names(x)) {
      v <- x[[sort_col]][idx]
      if (is.factor(v)) v <- as.character(v)
      ord <- order(v, decreasing = isTRUE(sort_desc), na.last = TRUE)
      idx <- idx[ord]
    }
    total <- length(idx)
    page <- idx[seq.int(from = offset + 1, length.out = max(0, min(limit, total - offset)))]
    cells <- lapply(x, function(col) rpad$cell_text(col[page]))
    rn <- rownames(x)[page]
    list(row_index = page, row_names = if (is.null(rn)) as.character(page) else rn,
         filtered = total, cells = unname(cells))
  }

  rpad$df_column_summary <- function(ref_kind, ref_name, col) {
    x <- rpad$resolve(ref_kind, ref_name)
    paste(capture.output(print(summary(x[[col]]))), collapse = "\n")
  }

  rpad$list_files <- function(dir = getwd()) {
    f <- list.files(dir, all.files = FALSE, include.dirs = TRUE, no.. = TRUE)
    if (length(f) == 0) return(list(name = character(0), size = numeric(0), mtime = numeric(0), isdir = logical(0)))
    info <- file.info(file.path(dir, f))
    list(name = f, size = as.numeric(info$size), mtime = as.numeric(info$mtime), isdir = info$isdir)
  }

  rpad$take_views <- function() {
    v <- rpad$pending_views
    rpad$pending_views <- character(0)
    v
  }

  rpad$View <- function(x, title) {
    expr <- substitute(x)
    if (missing(title)) title <- paste(deparse(expr), collapse = "")
    if (is.name(expr) && exists(as.character(expr), envir = globalenv(), inherits = FALSE)) {
      rpad$pending_views <- c(rpad$pending_views, paste0("global:", as.character(expr)))
    } else {
      rpad$views[[title]] <- x
      rpad$pending_views <- c(rpad$pending_views, paste0("view:", title))
    }
    invisible(NULL)
  }

  rpad$complete_expr <- function(lines) {
    # Returns the number of lines (from the start) that form the first complete R expression.
    n <- length(lines)
    for (k in seq_len(n)) {
      txt <- paste(lines[seq_len(k)], collapse = "\n")
      ok <- tryCatch({ parse(text = txt, keep.source = FALSE); TRUE },
        error = function(e) if (grepl("unexpected end of input|unexpected end of line|incomplete", conditionMessage(e))) NA else TRUE)
      if (isTRUE(ok)) return(k)
    }
    n
  }

  rpad$save_workspace <- function(path) {
    save(list = ls(envir = globalenv(), all.names = FALSE), file = path, envir = globalenv())
    ls(envir = globalenv())
  }

  rpad$ensure_pkg <- function(pkg) {
    nzchar(system.file(package = pkg))
  }

  rpad$pkg_available <- function(pkgs) {
    ap <- tryCatch(available.packages(repos = getOption("repos"), type = "source"), error = function(e) NULL)
    if (is.null(ap)) return(rep(NA, length(pkgs)))
    pkgs %in% rownames(ap)
  }

  assign("View", rpad$View, envir = rpad)
  assign("view", rpad$View, envir = rpad)
  attach(rpad, name = "rpad", warn.conflicts = FALSE)
})
options(webr.show_menu = FALSE, width = 100)
webr::shim_install()
invisible(NULL)
`;
