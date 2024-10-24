import React, { useRef, useEffect } from 'react';
import { Animated, StyleSheet } from 'react-native';

// Add smooth animations for value changes
export const AnimatedValue = ({ value, prefix = '', suffix = '' }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: value,
      useNativeDriver: true,
      tension: 40,
      friction: 8
    }).start();
  }, [value]);

  return (
    <Animated.Text style={[styles.value, { transform: [{ scale: animatedValue }] }]}>
      {prefix}{value}{suffix}
    </Animated.Text>
  );
};

const styles = StyleSheet.create({
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'black'
  }
});
