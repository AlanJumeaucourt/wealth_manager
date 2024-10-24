import { darkTheme } from '@/constants/theme';
import { Canvas, Path, SkFont, Skia, Text } from '@shopify/react-native-skia';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SharedValue } from 'react-native-reanimated';
import DonutPath from './DonutPath';

type Props = {
  n: number;
  gap: number;
  radius: number;
  strokeWidth: number;
  outerStrokeWidth: number;
  decimals: SharedValue<number[]>;
  colors: string[];
  totalValue: number;
  font: SkFont;
  smallFont: SkFont;
  totalText: string;
};

const DonutChart = ({
  n,
  gap = 0, // Set default gap to 0
  decimals,
  colors,
  totalValue,
  strokeWidth,
  outerStrokeWidth,
  radius,
  font,
  smallFont,
  totalText,
}: Props) => {
  const array = Array.from({ length: n });
  const innerRadius = radius - outerStrokeWidth / 2;

  const path = Skia.Path.Make();
  path.addCircle(radius, radius, innerRadius);

  const targetText = Math.round(totalValue).toString()

  return (
    <View style={styles.container}>
      <Canvas style={{ width: radius * 2, height: radius * 2 }}>
        <Path
          path={path}
          color="#f4f7fc"
          style="stroke"
          strokeJoin="round"
          strokeWidth={outerStrokeWidth}
          strokeCap="round"
          start={0}
          end={1}
        />
        {array.map((_, index) => {
          return (
            <DonutPath
              key={index}
              radius={radius}
              strokeWidth={strokeWidth}
              outerStrokeWidth={outerStrokeWidth}
              color={colors[index]}
              decimals={decimals}
              index={index}
              gap={gap} // Pass the gap value here
            />
          );
        })}
        <Text
          x={radius - smallFont.measureText(totalText).width / 2}
          y={radius - smallFont.measureText(totalText).y + 10}
          text={totalText}
          font={smallFont}
          color={darkTheme.colors.text}
          align="center"
          horizontalAlign="center"
        />
        <Text
          x={radius - font.measureText(targetText).width / 2}
          y={radius + font.measureText(targetText).y / 2 + 15}
          text={targetText}
          font={font}
          color={darkTheme.colors.text}
          align="center"
          horizontalAlign="center"
        />
      </Canvas>
    </View>
  );
};

export default DonutChart;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
