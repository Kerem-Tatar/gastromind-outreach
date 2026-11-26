'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '../app/login/actions.js';

const LINKS = [
  { href: '/funnel', label: 'Huni' },
  { href: '/businesses', label: 'İşletmeler' },
  { href: '/queue', label: 'Onay kuyruğu' },
  { href: '/campaigns', label: 'Mail şablonları' },
  { href: '/settings', label: 'Ayarlar' },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/funnel" className="flex items-center gap-2 font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-sm font-bold text-white">G</span>
          <span>Gastromind <span className="text-brand">Outreach</span></span>
        </Link>
        <nav className="flex flex-1 flex-wrap gap-1">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link key={l.href} href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm ${active ? 'bg-brand-light font-medium text-brand' : 'text-gray-600 hover:bg-gray-100'}`}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-accent">Çıkış</button>
        </form>
      </div>
    </header>
  );
}
