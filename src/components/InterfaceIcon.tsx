import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../theme';

export type InterfaceIconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Decorative icon for controls that already carry a text or accessibility
 * label. It is hidden from screen readers so the label is read exactly once.
 */
export default function InterfaceIcon({
  name,
  size = 20,
  color = C.muted,
}: {
  name: InterfaceIconName;
  size?: number;
  color?: string;
}) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
