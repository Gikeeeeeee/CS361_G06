import type { LucideIcon } from 'lucide-react';
import React from 'react';

export interface BottomNavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

export interface HeaderConfig {
  title?: string;
  showLogo?: boolean;
  rightAction?: React.ReactNode;
}
