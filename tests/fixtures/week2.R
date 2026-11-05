# R course for beginners
# Week 2
# assignment by Test Student

#### CREATE DATA ####

# 1. Generate variables
set.seed(2026)
subject    = 1:100
age        = sample(15:40, size = 100, replace = TRUE)
gender     = sample(c("male", "female"), size = 100, replace = TRUE)
iq         = rnorm(100, mean = 100, sd = 15)
depression = rbinom(100, 1, 0.15)
anxiety    = runif(100, min = 0, max = 100)

# 2. Combine into a data frame
df = data.frame(
  subject    = subject,
  age        = age,
  gender     = gender,
  iq         = iq,
  depression = depression,
  anxiety    = anxiety
)

# 3. Save as CSV
write.csv(df, "week2_data.csv", row.names = FALSE)

#### DESCRIBE DATA ####

# 1. Descriptive statistics for age
mean(df$age)
sd(df$age)
median(df$age)
min(df$age)
max(df$age)

# 2. Summary of the whole data frame
summary(df)

# 3. Histogram of age
hist(df$age, xlab = "age")
