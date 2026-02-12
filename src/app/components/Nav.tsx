'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/', label: 'Дашборд' },
  { href: '/rabochhee-vremya', label: 'Рабочее время' },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 p-2 bg-slate-900/80 rounded-xl border border-slate-800/50">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
