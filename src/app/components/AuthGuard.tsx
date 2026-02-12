'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Nav from './Nav';
import { isAuthenticated, logout } from '../lib/auth';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (isLoginPage) return;
    if (!isAuthenticated()) {
      router.replace('/login');
    }
  }, [mounted, pathname, isLoginPage, router]);

  if (!mounted || (!isLoginPage && !isAuthenticated())) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      <header className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Аналитика менеджеров
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">Панель KPIs и дашборды</p>
          </div>
          <div className="flex items-center gap-3">
            <Nav />
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 text-sm transition-colors"
            >
              Выход
            </button>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
