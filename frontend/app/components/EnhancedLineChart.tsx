// Add interactive charts with tooltips and zoom
export const EnhancedLineChart = ({ data, ...props }) => {
  return (
    <LineChart
      {...props}
      data={data}
      enablePanGesture
      enableScroll
      showTooltip
      tooltipComponent={
        <CustomTooltip />
      }
      showDots
      dotColor={darkTheme.colors.primary}
      dotSize={8}
      curved
    />
  );
};
