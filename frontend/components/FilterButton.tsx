import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors } from '@/constants/colors';

interface FilterButtonProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  width: number;
}

export const FilterButton: React.FC<FilterButtonProps> = ({ label, isSelected, onPress, width }) => (
  <Pressable
    style={[
      styles.filterButton,
      isSelected && styles.selectedFilter,
      { width },
    ]}
    onPress={onPress}
  >
    <Text style={[styles.filterText, isSelected && styles.selectedFilterText]}>
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  filterButton: {
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectedFilter: {
    backgroundColor: colors.primary,
  },
  filterText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  selectedFilterText: {
    color: colors.white,
  },
});