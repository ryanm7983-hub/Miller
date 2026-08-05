'use client';

import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export function SearchInput({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const value = String(new FormData(event.currentTarget).get('q') ?? '').trim();
        router.push(value ? `/app/search?q=${encodeURIComponent(value)}` : '/app/search');
      }}
      className="relative"
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
      <input
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus
        placeholder="Search documents, requirements, gaps, actions, people…"
        className="input h-12 pl-11 text-[15px]"
        aria-label="Search"
      />
    </form>
  );
}
