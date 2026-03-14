'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/training', label: 'Rutinas', icon: '◫' },
  { href: '/', label: 'Análisis', icon: '◎' },
  { href: '/history', label: 'Historial', icon: '▤' },
  { href: '/chats', label: 'Coach', icon: '✦' },
  { href: '/guidelines', label: 'Guidelines', icon: '◈' },
];

export default function NavBar() {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const dark = stored !== 'light';
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('light', !dark);
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', next);
    document.documentElement.classList.toggle('light', !next);
  }

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-[var(--border-color)] bg-background/90 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 h-full flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/dashboard" className="flex-shrink-0 flex items-center gap-1.5">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            FORM<span className="text-emerald-500">CHECK</span>
          </span>
        </Link>

        {/* Nav items */}
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all whitespace-nowrap ${
                  active
                    ? 'text-foreground bg-surface border border-[var(--border-color)]'
                    : 'text-[var(--muted)] hover:text-foreground hover:bg-surface/50'
                }`}
              >
                <span className="text-[13px]">{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border-color)] text-[var(--muted)] hover:text-foreground hover:bg-surface transition-all text-sm"
          title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {isDark ? '☀' : '☾'}
        </button>
      </div>
    </header>
  );
}
