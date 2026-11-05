/**
 * Course function reference. Only functions with a confirmed mapping to the
 * published course materials (weeks 1–3 and the unit book) are included.
 * Links point to the official course site.
 */
export const COURSE_BASE = 'https://nitzanshahar.github.io/r-code-course-psy-tau/';

export interface RefEntry {
  fn: string;
  syntax: string;
  he: string;
  en: string;
  example: string;
  /** Course unit id, e.g. "4.5" */
  unit: string;
  week: 1 | 2 | 3;
  /** Relative link on the course site. */
  link: string;
  note?: string;
}

export interface RefTopic {
  id: string;
  titleHe: string;
  titleEn: string;
  week: 1 | 2 | 3;
  entries: RefEntry[];
}

const W = (n: 1 | 2 | 3) => `week-${n}.html`;
const B = (ch: number) => `book.html#ch${ch}`;

export const COURSE_REFERENCE: RefTopic[] = [
  {
    id: 'basics',
    titleHe: 'אובייקטים בסיסיים',
    titleEn: 'Basic objects',
    week: 1,
    entries: [
      { fn: '<- / =', syntax: 'x <- 10', he: 'השמה: שומר ערך בתוך אובייקט. בקורס משתמשים גם ב-=.', en: 'Assignment: stores a value in an object. The course also uses =.', example: 'x = 10\nx = x * 2\nprint(x)', unit: '2.2', week: 1, link: B(2) },
      { fn: 'print()', syntax: 'print(x)', he: 'מדפיס אובייקט לקונסולה.', en: 'Prints an object to the console.', example: 'x = "hello world"\nprint(x)', unit: '2.3', week: 1, link: B(2) },
      { fn: 'class()', syntax: 'class(x)', he: 'מחזיר את סוג האובייקט (numeric, character, logical, factor...).', en: 'Returns the class of an object.', example: 'x = 5\nclass(x)\nclass("a")\nclass(TRUE)', unit: '2.2', week: 1, link: B(2) },
      { fn: 'typeof()', syntax: 'typeof(x)', he: 'מחזיר את סוג האחסון הפנימי (double, character, logical, integer).', en: 'Returns the internal storage type.', example: 'typeof(5)\ntypeof(5L)\ntypeof("a")', unit: '2.2', week: 1, link: B(2) },
      { fn: 'as.numeric()', syntax: 'as.numeric(x)', he: 'ממיר לערך מספרי. על factor מחזיר את הקידוד הנומרי (מתחיל ב-1).', en: 'Converts to numeric. On a factor it returns the integer codes (starting at 1).', example: 'gender = factor(c("male", "female", "female"))\nas.numeric(gender)', unit: '2.4', week: 3, link: W(3) },
      { fn: 'factor()', syntax: 'factor(x, levels = ..., labels = ...)', he: 'יוצר משתנה קטגוריאלי עם רמות (levels) ותוויות (labels). הקידוד הנומרי מתחיל ב-1.', en: 'Creates a categorical variable with levels and labels.', example: 'depression = c(0, 1, 0, 0, 1, 1, 0, 1, 0, 0)\ndepression_f = factor(depression, levels = c(0, 1), labels = c("no", "yes"))\ndepression_f', unit: '2.4', week: 3, link: W(3) },
      { fn: 'levels()', syntax: 'levels(f)', he: 'מחזיר את רמות המשתנה הקטגוריאלי.', en: 'Returns the levels of a factor.', example: 'gender = factor(c("male", "female", "female", "male"))\nlevels(gender)', unit: '2.4', week: 3, link: W(3) },
      { fn: 'logical', syntax: 'x > 5; x == 2', he: 'משתנה לוגי מקבל TRUE/FALSE. משמש לבדיקת תנאים ולאינדקס. הכפלה ב-1 הופכת ל-0/1.', en: 'Logical values are TRUE/FALSE; used for conditions and indexing. Multiplying by 1 gives 0/1.', example: 'x = 1:10\nx > 5\nx == 2\nx[x > 8]\n(x > 5) * 1', unit: '2.7', week: 3, link: W(3) },
    ],
  },
  {
    id: 'vectors',
    titleHe: 'וקטורים ודגימה',
    titleEn: 'Vectors and sampling',
    week: 1,
    entries: [
      { fn: 'c()', syntax: 'c(1, 2, 3)', he: 'יוצר וקטור. כל הערכים חייבים להיות מאותו סוג.', en: 'Creates a vector. All values must share one type.', example: 'x = c(8, 9, 4, 3)\nx * 2\nx^2\nprint(x)', unit: '3.2', week: 1, link: B(3) },
      { fn: 'seq()', syntax: 'seq(from, to, by)', he: 'יוצר רצף מספרים בקפיצות.', en: 'Creates a numeric sequence with a step.', example: 'seq(1, 10, by = 1)\nseq(1, 20, by = 5)\nx = 1:100', unit: '3.3', week: 2, link: W(2) },
      { fn: 'sample()', syntax: 'sample(x, size, replace = FALSE, prob = NULL)', he: 'דגימה אקראית מוקטור. replace = TRUE מאפשר חזרות; prob קובע הסתברויות.', en: 'Random sampling from a vector. replace = TRUE allows repeats; prob sets probabilities.', example: 'x = c(10, 100)\ny = sample(x, size = 10, replace = TRUE, prob = c(0.2, 0.8))\ngender = sample(c("male", "female"), size = 100, replace = TRUE)', unit: '3.5', week: 2, link: W(2), note: 'sample(x, 10, replace = FALSE) when x has only two values gives an error – sampling without replacement cannot exceed the vector length.' },
      { fn: 'set.seed()', syntax: 'set.seed(123)', he: 'קובע נקודת התחלה לדגימה אקראית כדי שהתוצאות יהיו ניתנות לשחזור.', en: 'Fixes the random seed so results are reproducible.', example: 'set.seed(123)\nsample(1:10, 2)', unit: '3.5', week: 2, link: W(2) },
      { fn: 'rnorm()', syntax: 'rnorm(n, mean = 0, sd = 1)', he: 'דגימה מהתפלגות נורמלית.', en: 'Samples from a normal distribution.', example: 'iq = rnorm(100, mean = 100, sd = 15)\nmean(iq)', unit: '5.3', week: 2, link: W(2) },
      { fn: 'rbinom()', syntax: 'rbinom(n, size, prob)', he: 'דגימה מהתפלגות בינומית. עם size = 1 זו התפלגות ברנולי (0/1).', en: 'Samples from a binomial distribution; size = 1 is Bernoulli (0/1).', example: 'depression = rbinom(100, 1, 0.15)\ntable(depression)', unit: '5.1', week: 2, link: W(2) },
      { fn: 'runif()', syntax: 'runif(n, min = 0, max = 1)', he: 'דגימה מהתפלגות אחידה רציפה.', en: 'Samples from a continuous uniform distribution.', example: 'anxiety = runif(100, min = 0, max = 100)', unit: '5.3', week: 2, link: W(2) },
    ],
  },
  {
    id: 'dataframe',
    titleHe: 'טבלת נתונים (data frame)',
    titleEn: 'Data frames',
    week: 1,
    entries: [
      { fn: 'data.frame()', syntax: 'data.frame(col1 = x, col2 = y)', he: 'מאגד וקטורים באותו אורך לטבלת נתונים. כל שורה תצפית, כל עמודה משתנה.', en: 'Combines equal-length vectors into a table: rows are observations, columns are variables.', example: 'subject = 1:6\ngender = c("male", "male", "female", "female", "female", "male")\nage = c(15, 29, 31, 28, 20, 35)\ndf = data.frame(subject = subject, gender = gender, age = age)\nprint(df)', unit: '4.1', week: 1, link: B(4) },
      { fn: 'View()', syntax: 'View(df)', he: 'פותח את טבלת הנתונים במציג (ב-RPad: מציג הנתונים המובנה).', en: 'Opens the data frame in a viewer (in RPad, the built-in data viewer).', example: 'View(df)', unit: '4.1', week: 1, link: B(4) },
      { fn: 'names()', syntax: 'names(df)', he: 'שמות המשתנים (העמודות).', en: 'Variable (column) names.', example: 'names(df)', unit: '4.3', week: 2, link: W(2) },
      { fn: '$', syntax: 'df$age', he: 'גישה למשתנה יחיד בטבלה.', en: 'Access a single column.', example: 'df$age\nmean(df$age)', unit: '4.3', week: 2, link: W(2) },
      { fn: '[row, col]', syntax: 'df[1, 1]; df[2:4, 3]; df[2:4, "age"]; df[5, ]', he: 'אינדקס: שורות ועמודות לפי מספר או שם. השארת מקום ריק = כל השורות/העמודות.', en: 'Indexing rows and columns by number or name; an empty slot means all.', example: 'df[1, 1]\ndf[2:4, 3]\ndf[2:4, "age"]\ndf[5, ]\nmean(df[1:10, "age"])', unit: '4.4', week: 3, link: W(3) },
      { fn: 'delete / modify', syntax: 'df$col <- NULL; df <- df[-c(60, 72), ]; df[10, "age"] <- 25', he: 'הסרת עמודה עם NULL, הסרת שורות עם אינדקס שלילי, שינוי תא בודד בהשמה.', en: 'Remove a column with NULL, remove rows with negative indices, change a cell by assignment.', example: 'df$depression <- NULL\ndf <- df[-c(60, 72), ]\ndf[10, "age"]\ndf[10, "age"] <- 25\ndf[10, "age"]', unit: '4.4', week: 3, link: W(3) },
      { fn: 'head() / tail()', syntax: 'head(df, 10); tail(df, 10)', he: 'השורות הראשונות / האחרונות.', en: 'First / last rows.', example: 'head(df, 10)\ntail(df, 10)', unit: '4.5', week: 2, link: W(2) },
      { fn: 'dim() / nrow() / ncol()', syntax: 'dim(df); nrow(df); ncol(df)', he: 'מימדי הטבלה: מספר שורות ועמודות.', en: 'Table dimensions: rows and columns.', example: 'dim(df)\nnrow(df)\nncol(df)', unit: '4.5', week: 2, link: W(2) },
      { fn: 'length() / unique()', syntax: 'length(df$age); unique(df$gender)', he: 'אורך וקטור / ערכים ייחודיים.', en: 'Vector length / unique values.', example: 'length(df$age)\nunique(df$gender)', unit: '4.5', week: 2, link: W(2) },
      { fn: 'summary()', syntax: 'summary(df); summary(df$age)', he: 'סטטיסטיקה תיאורית מסכמת לטבלה שלמה או למשתנה.', en: 'Summary statistics for a whole table or one variable.', example: 'summary(df)\nsummary(df$age)', unit: '4.5', week: 2, link: W(2) },
    ],
  },
  {
    id: 'descriptive',
    titleHe: 'סטטיסטיקה תיאורית',
    titleEn: 'Descriptive statistics',
    week: 2,
    entries: [
      { fn: 'mean() / median() / sd()', syntax: 'mean(x, na.rm = TRUE)', he: 'ממוצע, חציון וסטיית תקן. na.rm = TRUE מתעלם מערכים חסרים.', en: 'Mean, median and standard deviation. na.rm = TRUE ignores NA.', example: 'mean(df$age)\nmedian(df$age)\nsd(df$age)', unit: '4.5', week: 2, link: W(2) },
      { fn: 'min() / max()', syntax: 'min(x); max(x)', he: 'מינימום ומקסימום.', en: 'Minimum and maximum.', example: 'min(df$age)\nmax(df$age)', unit: '4.5', week: 2, link: W(2) },
      { fn: 'quantile()', syntax: 'quantile(x, 0.75)', he: 'אחוזון.', en: 'Quantile.', example: 'quantile(df$age, 0.75)', unit: '4.5', week: 2, link: W(2) },
      { fn: 'rowSums() / colMeans()', syntax: 'rowSums(df); rowMeans(df); colSums(df); colMeans(df)', he: 'סכום/ממוצע לפי שורות או עמודות (לעמודות מספריות בלבד).', en: 'Sums/means by row or column (numeric columns only).', example: 'colMeans(df[, c("age", "iq")])\nrowSums(df[, c("age", "iq")])', unit: '4.5', week: 2, link: W(2) },
      { fn: 'median split', syntax: 'df$iq_group <- df$iq > median(df$iq)', he: 'יצירת משתנה לוגי לפי חציון (median split).', en: 'Logical variable from a median split.', example: 'df$iq_group <- df$iq > median(df$iq)\ntable(df$iq_group)', unit: '2.7', week: 3, link: W(3) },
    ],
  },
  {
    id: 'dplyr',
    titleHe: 'חבילת dplyr',
    titleEn: 'dplyr',
    week: 3,
    entries: [
      { fn: 'library(dplyr)', syntax: 'library(dplyr)', he: 'טוען את החבילה. ב-RPad החבילה יורדת אוטומטית בפעם הראשונה.', en: 'Loads the package. In RPad the package is downloaded automatically on first use.', example: 'library(dplyr)', unit: '4.7', week: 3, link: W(3) },
      { fn: '|> (pipe)', syntax: 'df |> filter(age > 40)', he: 'מעביר את התוצאה משמאל כקלט לפונקציה מימין. הצינור לא משנה את הטבלה המקורית – כדי לשמור יש להשים לאובייקט.', en: 'Passes the left result into the right function. Piping does not change the original table; assign to keep.', example: 'library(dplyr)\ndf |> filter(age > 40)\ndf_adults <- df |> filter(age > 18)', unit: '4.7', week: 3, link: W(3) },
      { fn: 'filter()', syntax: 'filter(df, condition)', he: 'בוחר שורות לפי תנאי.', en: 'Keeps rows matching a condition.', example: 'df |> filter(gender == "female", iq > 100)', unit: '4.7', week: 3, link: W(3) },
      { fn: 'select()', syntax: 'select(df, col1, col2)', he: 'בוחר עמודות.', en: 'Keeps selected columns.', example: 'df |> select(subject, age, iq)', unit: '4.7', week: 3, link: W(3) },
      { fn: 'arrange()', syntax: 'arrange(df, col); arrange(df, desc(col))', he: 'ממיין שורות.', en: 'Sorts rows.', example: 'df |> filter(gender == "female") |> select(subject, age, iq) |> arrange(age)', unit: '4.7', week: 3, link: W(3) },
      { fn: 'mutate()', syntax: 'mutate(df, new = expr)', he: 'יוצר או משנה עמודה.', en: 'Creates or changes a column.', example: 'df |> mutate(depression = depression * 100)', unit: '4.8', week: 3, link: W(3) },
      { fn: 'summarise() / n()', syntax: 'summarise(df, n = n(), m = mean(x))', he: 'מסכם טבלה לשורה אחת; n() סופר תצפיות.', en: 'Summarises a table into one row; n() counts observations.', example: 'df |> summarise(n = n(), min_age = min(age), max_age = max(age), mean_depression = mean(depression))', unit: '4.8', week: 3, link: W(3) },
      { fn: 'group_by()', syntax: 'df |> group_by(gender) |> summarise(...)', he: 'סטטיסטיקה לפי קבוצה.', en: 'Statistics by group.', example: 'df |> filter(age > 18) |> group_by(gender) |> summarise(n = n(), min_age = min(age), max_age = max(age), mean_depression = mean(depression))', unit: '4.9', week: 3, link: W(3) },
      { fn: 'summary() after pipe', syntax: 'df |> filter(...) |> summary()', he: 'סטטיסטיקה תיאורית של טבלה מפולטרת.', en: 'Descriptive statistics of a filtered table.', example: 'df |> filter(iq > median(iq)) |> summary()', unit: '4.7', week: 3, link: W(3) },
    ],
  },
  {
    id: 'graphics',
    titleHe: 'גרפיקה',
    titleEn: 'Graphics',
    week: 2,
    entries: [
      { fn: 'hist()', syntax: 'hist(x, xlab = "age", xlim = c(0, 50))', he: 'היסטוגרמה מהירה בחבילת הבסיס. xlim שולט בטווח ציר X.', en: 'Quick base-R histogram. xlim controls the x-axis range.', example: 'hist(df$age, xlab = "age")', unit: '6.1', week: 2, link: W(2) },
      { fn: 'boxplot()', syntax: 'boxplot(y ~ group, data = df)', he: 'תרשים קופסה בחבילת הבסיס.', en: 'Base-R box plot.', example: 'boxplot(anxiety ~ gender, data = df, xlab = "gender", ylab = "anxiety")', unit: '6.1', week: 2, link: W(2) },
      { fn: 'plot()', syntax: 'plot(x, y)', he: 'תרשים פיזור בסיסי.', en: 'Basic scatter plot.', example: 'plot(df$age, df$iq, xlab = "age", ylab = "IQ")', unit: '6.1', week: 2, link: W(2) },
      { fn: 'ggplot() + aes()', syntax: 'ggplot(df, aes(x = var)) + geom_...', he: 'דקדוק הגרפיקה: data, aesthetics, geometry.', en: 'Grammar of graphics: data, aesthetics, geometry.', example: 'library(ggplot2)\nggplot(df, aes(x = age)) + geom_histogram()', unit: '6.2', week: 3, link: W(3) },
      { fn: 'geom_histogram()', syntax: 'geom_histogram(fill = "steelblue")', he: 'היסטוגרמה למשתנה רציף.', en: 'Histogram for a continuous variable.', example: 'ggplot(df, aes(x = anxiety)) +\n  geom_histogram(fill = "steelblue") +\n  xlim(0, 100) + xlab("anxiety") + ylab("count")', unit: '6.3', week: 3, link: W(3) },
      { fn: 'geom_boxplot()', syntax: 'ggplot(df, aes(x = group, y = value)) + geom_boxplot()', he: 'תרשים קופסה לפי קבוצה.', en: 'Box plot by group.', example: 'ggplot(df, aes(x = gender, y = anxiety, fill = gender)) +\n  geom_boxplot() + xlab("gender") + ylab("anxiety")', unit: '6.3', week: 3, link: W(3) },
      { fn: 'geom_dotplot() / geom_density()', syntax: 'geom_dotplot(); geom_density()', he: 'תרשים נקודות / צפיפות.', en: 'Dot plot / density plot.', example: 'ggplot(df, aes(x = iq)) + geom_density(fill = "grey80")', unit: '6.3', week: 3, link: W(3) },
      { fn: 'xlim / ylim / xlab / ylab', syntax: '+ xlim(0, 100) + xlab("age")', he: 'טווח צירים וכותרות צירים.', en: 'Axis ranges and labels.', example: 'ggplot(df, aes(x = age)) + geom_histogram() + xlim(0, 100) + xlab("age") + ylab("count")', unit: '6.3', week: 3, link: W(3) },
      { fn: 'ggsave()', syntax: 'ggsave("plot.png", width = 6, height = 4)', he: 'שומר את הגרף האחרון לקובץ בתיקיית העבודה. ב-RPad הקובץ מופיע בלשונית הקבצים ובגלריית הגרפים.', en: 'Saves the last plot to a file in the working directory. In RPad the file appears under Files and in the plot gallery.', example: 'ggsave("anxiety_by_gender.png", width = 6, height = 4, dpi = 150)', unit: '6.3', week: 3, link: W(3) },
    ],
  },
  {
    id: 'files',
    titleHe: 'קבצים ותיקיית עבודה',
    titleEn: 'Files and working directory',
    week: 1,
    entries: [
      { fn: 'getwd() / dir()', syntax: 'getwd(); dir()', he: 'תיקיית העבודה והקבצים שבה. ב-RPad לכל פרויקט תיקייה משלו במערכת קבצים וירטואלית.', en: 'The working directory and its files. In RPad each project has its own folder in a virtual file system.', example: 'getwd()\ndir()', unit: '1.7', week: 1, link: B(1) },
      { fn: 'write.csv()', syntax: 'write.csv(df, "data.csv", row.names = FALSE)', he: 'שומר טבלה כקובץ CSV. הקובץ מופיע בלשונית הקבצים וניתן להורדה.', en: 'Saves a table as CSV. The file appears under Files and can be downloaded.', example: 'write.csv(df, "data.csv", row.names = FALSE)', unit: '4.2', week: 1, link: B(4) },
      { fn: 'read.csv()', syntax: 'df <- read.csv("data.csv")', he: 'טוען קובץ CSV לטבלת נתונים. שימו לב: הארגומנט הראשון הוא שם הקובץ (לא df).', en: 'Reads a CSV file into a data frame. Note: the first argument is the file name (not df).', example: 'df <- read.csv("data.csv")\nhead(df)', unit: '4.2', week: 3, link: W(3), note: 'The course book shows read.csv(df, file = ...); the correct R call is df <- read.csv("file.csv").' },
      { fn: 'save() / load()', syntax: 'save(df, file = "df.RData"); load("df.RData")', he: 'שמירה וטעינה של אובייקטים בפורמט של R. load() מחזיר את האובייקטים לסביבה בשמם המקורי.', en: 'Save and load objects in R format. load() restores objects under their original names.', example: 'save(df, file = "df.RData")\nrm(df)\nload("df.RData")\nhead(df)', unit: '4.2', week: 1, link: B(4), note: 'The course book shows load(df, file = ...); the correct call is load("df.RData").' },
    ],
  },
  {
    id: 'style',
    titleHe: 'כתיבת קוד וכותרות',
    titleEn: 'Code style and headers',
    week: 1,
    entries: [
      { fn: 'header comments', syntax: '# R course for beginners\n# Week 1\n# assignment by ...', he: 'שלוש שורות תיעוד בתחילת כל סקריפט: קורס, שבוע, שם.', en: 'Three documentation lines at the top: course, week, name.', example: '# R course for beginners\n# Week 1\n# assignment by Moran Levi', unit: '11.2', week: 1, link: B(11) },
      { fn: 'main heading', syntax: '#### TITLE ####', he: 'כותרת ראשית באותיות גדולות עם ארבעה # לפני ואחרי.', en: 'Main heading in capitals with four # before and after.', example: '#### CREATE DATAFRAME ####', unit: '11.2', week: 1, link: B(11) },
      { fn: 'sub heading', syntax: '# 1. Save', he: 'כותרת משנה ממוספרת עם מילת פעולה.', en: 'Numbered sub heading with an action verb.', example: '# 1. Generate data\n# 2. Combine into a data frame\n# 3. Save data frame to CSV', unit: '11.2', week: 1, link: B(11) },
      { fn: 'names and spacing', syntax: 'reaction_time = (100 + 3) - 2', he: 'שמות מלאים באותיות קטנות עם קו תחתון; רווחים סביב אופרטורים; df הוא קיצור מוסכם לטבלה.', en: 'Full lowercase names with underscores; spaces around operators; df is the accepted abbreviation for a data frame.', example: '#### CREATE VAR ####\n\n# 1. Assign values\na = (100 + 3) - 2\nb = 10\nc = a + b\n\n# 2. Examine\nprint(c)', unit: '11.3', week: 1, link: B(11) },
    ],
  },
];

export function searchReference(query: string): RefEntry[] {
  const q = query.trim().toLowerCase();
  const all = COURSE_REFERENCE.flatMap((t) => t.entries);
  if (!q) return all;
  return all.filter((e) => e.fn.toLowerCase().includes(q) || e.he.includes(q) || e.en.toLowerCase().includes(q) || e.syntax.toLowerCase().includes(q));
}
