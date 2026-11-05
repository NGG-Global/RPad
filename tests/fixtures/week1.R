# R course for beginners
# Week 1
# assignment by Test Student

#### CREATE DATAFRAME ####

# 1. Generate data
subject    = c(1, 2, 3, 4, 5, 6)
gender     = c("male", "male", "female", "female", "female", "male")
age        = c(15, 29, 31, 28, 20, 35)
depression = c(0, 1, 0, 0, 1, 1)

# 2. Combine into a data frame
df = data.frame(
  subject    = subject,
  gender     = gender,
  age        = age,
  depression = depression
)

# 3. Inspect
print(df)
dim(df)

# 4. Save data frame to CSV
write.csv(df, "week1_data.csv", row.names = FALSE)
dir()
