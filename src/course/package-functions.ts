/**
 * Functions from course packages, used only to show a UI hint when R reports
 * `could not find function "x"` (install is not the same as library()).
 */
export const PACKAGE_FUNCTIONS: Record<string, string> = Object.fromEntries([
  ...['filter', 'select', 'arrange', 'mutate', 'summarise', 'summarize', 'group_by', 'ungroup', 'n', 'n_distinct', 'rename', 'slice', 'pull', 'count', 'desc', 'across', 'left_join', 'inner_join', 'bind_rows', 'distinct', 'relocate', 'tibble', 'glimpse'].map((f) => [f, 'dplyr']),
  ...['ggplot', 'aes', 'geom_histogram', 'geom_dotplot', 'geom_boxplot', 'geom_density', 'geom_point', 'geom_bar', 'geom_col', 'geom_line', 'geom_smooth', 'geom_violin', 'geom_jitter', 'ggsave', 'xlab', 'ylab', 'xlim', 'ylim', 'labs', 'ggtitle', 'theme_minimal', 'theme_bw', 'theme_classic', 'facet_wrap', 'facet_grid', 'scale_fill_manual', 'scale_x_continuous', 'scale_y_continuous'].map((f) => [f, 'ggplot2']),
  ...['pivot_longer', 'pivot_wider', 'drop_na', 'separate', 'unite'].map((f) => [f, 'tidyr']),
  ...['read_csv', 'write_csv'].map((f) => [f, 'readr']),
  ...['str_detect', 'str_replace', 'str_to_lower', 'str_to_upper', 'str_trim', 'str_c'].map((f) => [f, 'stringr']),
]);

/** Returns the package that provides the missing function named in an R error, if known. */
export function missingFunctionPackage(errorText: string): { fn: string; pkg: string } | null {
  const m = /could not find function "([A-Za-z_.][A-Za-z0-9_.]*)"/.exec(errorText);
  if (!m) return null;
  const pkg = PACKAGE_FUNCTIONS[m[1]];
  return pkg ? { fn: m[1], pkg } : null;
}
