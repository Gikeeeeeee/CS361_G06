import { LayoutDashboard, CalendarDays, Building2, Settings } from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
  children?: NavItem[];
}

export const adminNavConfig: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/admin',
    icon: LayoutDashboard,
  },
  {
    label: 'Schedules & Allocation',
    path: '/admin/schedules',
    icon: CalendarDays,
  },
  {
    label: 'Buildings',
    path: '/admin/buildings',
    icon: Building2,
  },
  {
    label: 'Settings',
    path: '/admin/settings',
    icon: Settings,
  },
];
