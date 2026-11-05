/** Course-style script template following the documented conventions (chapter 11 of the course book). */
export function courseTemplate(opts: { week?: number; student?: string; assignment?: string } = {}): string {
  const week = opts.week ?? 1;
  const student = opts.student?.trim() || '< First Name > < Last Name >';
  const assignment = opts.assignment?.trim() || `Week ${week} assignment`;
  return `# R course for beginners
# Week ${week}
# assignment by ${student}
# ${assignment}

#### CREATE DATA ####

# 1. Generate variables
subject = c(1, 2, 3, 4, 5, 6)
gender  = c("male", "male", "female", "female", "female", "male")
age     = c(15, 29, 31, 28, 20, 35)

# 2. Combine into a data frame
df = data.frame(
  subject = subject,
  gender  = gender,
  age     = age
)

#### DESCRIBE DATA ####

# 1. Print the data frame
print(df)

# 2. Summarise
summary(df)

#### SAVE ####

# 1. Save as CSV
write.csv(df, "data.csv", row.names = FALSE)
`;
}
