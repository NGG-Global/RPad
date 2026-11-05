# R course for beginners
# Week 3
# assignment by Test Student

#### LOAD DATA ####

# 1. Load last week's CSV
df = read.csv("week2_data.csv")

#### EDIT DATA ####

# 1. Print a column and a row
df$age
df[5, ]

# 2. Remove the depression column and rows 60 and 72
df$depression = NULL
df = df[-c(60, 72), ]

# 3. Change a single cell
df[10, "age"]
df[10, "age"] = 99
df[10, "age"]

# 4. Dimensions
dim(df)

# 5. Median split on IQ
df$iq_group = df$iq > median(df$iq)
table(df$iq_group)

# 6. Gender as a factor
df$gender = factor(df$gender)
levels(df$gender)

# 7. High-IQ females
df_high_iq_female = df[df$gender == "female" & df$iq_group == TRUE, ]
nrow(df_high_iq_female)

#### DESCRIBE DATA ####

library(dplyr)

# 1. Age of high-IQ subjects
df |> filter(iq_group == TRUE) |> select(age) |> summary()

# 2. Age of high-IQ subjects by gender
df |> filter(iq_group == TRUE) |> group_by(gender) |> summarise(n = n(), mean_age = mean(age), sd_age = sd(age))

# 3. Summary of the high-IQ female subset
summary(df_high_iq_female)

#### PLOT ####

library(ggplot2)

# 1. Anxiety by gender
ggplot(df, aes(x = gender, y = anxiety, fill = gender)) +
  geom_boxplot() +
  xlab("gender") + ylab("anxiety")

# 2. Save the plot
ggsave("anxiety_by_gender.png", width = 6, height = 4, dpi = 100)
dir()
