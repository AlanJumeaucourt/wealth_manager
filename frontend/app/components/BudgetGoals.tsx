// Add budget goals tracking
export const BudgetGoals = () => {
  return (
    <CustomCard>
      <Text style={styles.title}>Budget Goals</Text>
      <ProgressBar
        progress={0.7}
        color={darkTheme.colors.primary}
      />
      <Text>70% of monthly savings goal reached</Text>
    </CustomCard>
  );
};
