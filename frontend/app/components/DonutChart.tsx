import DonutPath from '@/app/components/DonutPath';
import { darkTheme } from '@/constants/theme';
import { Canvas, Path, SkFont, Skia, Text } from '@shopify/react-native-skia';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SharedValue } from 'react-native-reanimated';

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
  gap = 0,
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

  const targetText = Math.round(totalValue).toString();

  const totalTextWidth = smallFont?.measureText(totalText)?.width ?? 0;
  const totalTextY = smallFont?.measureText(totalText)?.y ?? 0;
  const targetTextWidth = font?.measureText(targetText)?.width ?? 0;
  const targetTextY = font?.measureText(targetText)?.y ?? 0;

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
        {array.map((_, index) => (
          <DonutPath
            key={index}
            radius={radius}
            strokeWidth={strokeWidth}
            outerStrokeWidth={outerStrokeWidth}
            color={colors[index]}
            decimals={decimals}
            index={index}
            gap={gap}
          />
        ))}
        {smallFont && (
          <Text
            x={radius - totalTextWidth / 2}
            y={radius - totalTextY + 10}
            text={totalText}
            font={smallFont}
            color={darkTheme.colors.text}
            align="center"
            horizontalAlign="center"
          />
        )}
        {font && (
          <Text
            x={radius - targetTextWidth / 2}
            y={radius + targetTextY / 2 + 15}
            text={targetText}
            font={font}
            color={darkTheme.colors.text}
            align="center"
            horizontalAlign="center"
          />
        )}
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
