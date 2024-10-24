// Add custom tab navigator with animations
export const CustomTabBar = ({ state, navigation }) => {
  return (
    <View style={styles.tabBar}>
      {state.routes.map((route, index) => (
        <TouchableOpacity
          key={route.key}
          onPress={() => navigation.navigate(route.name)}
          style={[
            styles.tabItem,
            state.index === index && styles.tabItemActive
          ]}
        >
          <TabIcon route={route} active={state.index === index} />
          <AnimatedText active={state.index === index}>
            {route.name}
          </AnimatedText>
        </TouchableOpacity>
      ))}
    </View>
  );
};
