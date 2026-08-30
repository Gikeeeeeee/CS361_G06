import { Outlet } from 'react-router-dom';
import { MobileLayout } from '../shared/components/layout/MobileLayout';

export default function RootLayout() {
  return (
    <MobileLayout>
      <Outlet />
    </MobileLayout>
  );
}
