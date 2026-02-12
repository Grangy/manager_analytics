'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  isBanned,
  getBanEndTime,
  getRemainingAttempts,
  recordFailedAttempt,
  setAuthenticated,
  isAuthenticated,
} from '../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && isAuthenticated()) {
      router.replace('/');
    }
  }, [mounted, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password.trim()) {
      setError('Введите пароль');
      return;
    }
    if (isBanned()) {
      setError(`Доступ заблокирован до ${getBanEndTime().toLocaleString('ru')}`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setAuthenticated(true);
        router.replace('/');
        return;
      }
      recordFailedAttempt();
      const remaining = getRemainingAttempts();
      if (remaining <= 0) {
        setError(
          `Слишком много попыток. Доступ заблокирован на 24 часа до ${getBanEndTime().toLocaleString('ru')}`
        );
      } else {
        setError(`Неверный пароль. Осталось попыток: ${remaining}`);
      }
      setPassword('');
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const banned = isBanned();
  const banEnd = getBanEndTime();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            Аналитика менеджеров
          </h1>
          <p className="text-slate-500 text-sm mt-1">Введите пароль для доступа</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-slate-900/80 border border-slate-700/50 p-6 space-y-4"
        >
          {banned ? (
            <div className="py-4 text-center">
              <p className="text-rose-400 font-medium">Доступ заблокирован</p>
              <p className="text-slate-400 text-sm mt-2">
                Слишком много неверных попыток.
                <br />
                Блокировка до: <span className="text-slate-300">{banEnd.toLocaleString('ru')}</span>
              </p>
            </div>
          ) : (
            <>
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Пароль"
                  className="w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50"
                  autoFocus
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <p className="text-rose-400 text-sm text-center">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-medium hover:from-violet-500 hover:to-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? 'Проверка...' : 'Войти'}
              </button>
            </>
          )}
        </form>

        {!banned && getRemainingAttempts() < 10 && (
          <p className="text-slate-500 text-xs text-center mt-3">
            Осталось попыток: {getRemainingAttempts()}
          </p>
        )}

        <p className="text-slate-600 text-xs text-center mt-6">
          10 неверных попыток = блокировка на 24 часа
        </p>
      </div>
    </div>
  );
}
