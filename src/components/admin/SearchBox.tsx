'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import styles from './Admin.module.css';

interface SearchBoxProps {
  basePath: string;
  value: string;
  placeholder?: string;
  /** Query params that must survive a search, e.g. an active action filter. */
  preserve?: Record<string, string>;
}

/** URL-driven search input. Debounced, and resets pagination on every change. */
export default function SearchBox({
  basePath,
  value,
  placeholder = 'Search…',
  preserve = {},
}: SearchBoxProps) {
  const router = useRouter();
  const [term, setTerm] = useState(value);
  const firstRender = useRef(true);

  const push = (next: string) => {
    const params = new URLSearchParams();
    Object.entries(preserve).forEach(([k, v]) => v && params.set(k, v));
    if (next) params.set('q', next);
    const qs = params.toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath);
  };

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (term === value) return;
    const t = setTimeout(() => push(term), 350);
    return () => clearTimeout(t);
    // `push` closes over `preserve`, which is a new object each render; keying
    // on `term` alone is what makes the debounce actually settle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  useEffect(() => {
    setTerm(prev => (prev === value ? prev : value));
  }, [value]);

  return (
    <div className={styles.searchWrap}>
      <span className={styles.searchIcon}>
        <Search size={16} />
      </span>
      <input
        type="search"
        className={styles.searchInput}
        placeholder={placeholder}
        value={term}
        onChange={e => setTerm(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') push(term);
        }}
        aria-label={placeholder}
      />
      {term && (
        <button
          type="button"
          className={styles.searchIcon}
          style={{ left: 'auto', right: 10, cursor: 'pointer', pointerEvents: 'auto' }}
          onClick={() => {
            setTerm('');
            push('');
          }}
          aria-label="Clear search"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
