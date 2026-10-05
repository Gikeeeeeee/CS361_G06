import { CalendarCog, PlusCircle, Building2, Settings } from 'lucide-react';
export interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
  children?: NavItem[];
}
export const adminNavConfig: NavItem[] = [
  {
    label: 'Manage Schedules',
    path: '/admin/schedules/manage',
    icon: CalendarCog,
  },
  {
    label: 'Add Schedule',
    path: '/admin/add-schedule',
    icon: PlusCircle,
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
