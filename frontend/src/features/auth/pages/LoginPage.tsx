import React from 'react';
import { LoginForm } from '../components/LoginForm';

export const LoginPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-0 md:p-6 text-slate-900">
      {/* Mobile Frame Container matching UserLayout */}
      <div className="w-full h-[100dvh] md:h-auto md:min-h-[580px] md:max-w-md mx-auto bg-white shadow-2xl md:rounded-3xl md:border md:border-slate-200/80 relative flex flex-col overflow-y-auto">
        <LoginForm />
      </div>
    </div>
  );
};

export default LoginPage;
