'use client';

const AUTH_KEY = 'ai_analytics_auth';
const ATTEMPTS_KEY = 'ai_analytics_attempts';
const BAN_UNTIL_KEY = 'ai_analytics_ban_until';
const MAX_ATTEMPTS = 10;
const BAN_HOURS = 24;

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AUTH_KEY) === '1';
}

export function setAuthenticated(value: boolean): void {
  if (typeof window === 'undefined') return;
  if (value) {
    localStorage.setItem(AUTH_KEY, '1');
    localStorage.removeItem(ATTEMPTS_KEY);
    localStorage.removeItem(BAN_UNTIL_KEY);
  } else {
    localStorage.removeItem(AUTH_KEY);
  }
}

export function logout(): void {
  setAuthenticated(false);
}

export function getAttempts(): number {
  if (typeof window === 'undefined') return 0;
  return parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0', 10);
}

export function getBanUntil(): number {
  if (typeof window === 'undefined') return 0;
  return parseInt(localStorage.getItem(BAN_UNTIL_KEY) || '0', 10);
}

export function isBanned(): boolean {
  const until = getBanUntil();
  if (until <= 0) return false;
  if (Date.now() >= until) {
    localStorage.removeItem(BAN_UNTIL_KEY);
    localStorage.removeItem(ATTEMPTS_KEY);
    return false;
  }
  return true;
}

export function recordFailedAttempt(): void {
  if (typeof window === 'undefined') return;
  const attempts = getAttempts() + 1;
  localStorage.setItem(ATTEMPTS_KEY, String(attempts));
  if (attempts >= MAX_ATTEMPTS) {
    const banUntil = Date.now() + BAN_HOURS * 60 * 60 * 1000;
    localStorage.setItem(BAN_UNTIL_KEY, String(banUntil));
    localStorage.setItem(ATTEMPTS_KEY, '0');
  }
}

export function getRemainingAttempts(): number {
  return Math.max(0, MAX_ATTEMPTS - getAttempts());
}

export function getBanEndTime(): Date {
  return new Date(getBanUntil());
}
