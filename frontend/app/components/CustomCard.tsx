import styled from 'styled-components';
import { darkTheme } from '../../constants/theme';

// Create reusable styled components
export const CustomCard = styled.View`
  background-color: ${darkTheme.colors.surface};
  border-radius: ${darkTheme.borderRadius.l}px;
  padding: ${darkTheme.spacing.m}px;
  margin: ${darkTheme.spacing.s}px;
  shadow-color: #000;
  shadow-offset: 0px 2px;
  shadow-opacity: 0.25;
  shadow-radius: 3.84px;
  elevation: 5;
`;
