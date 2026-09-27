import { Outlet } from 'react-router-dom';
import { MobileLayout } from '../components/layout/MobileLayout';

export default function RootLayout() {
  return (
    <MobileLayout>
      <Outlet />
    </MobileLayout>
  );
}
