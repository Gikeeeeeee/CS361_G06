import { Home, Bookmark, User } from 'lucide-react';
import type { BottomNavItem, HeaderConfig } from '../types/navigation.types';

export const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  {
    label: 'Home',
    path: '/',
    icon: Home,
  },
  {
    label: 'Saved',
    path: '/saved',
    icon: Bookmark,
  },
  {
    label: 'Profile',
    path: '/profile',
    icon: User,
  },
];

export const HEADER_CONFIG: HeaderConfig = {
  title: 'CampusNav',
  showLogo: true,
};
