'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowUpDown, X } from 'lucide-react';
import styles from './Admin.module.css';

export interface ToolbarState {
  search: string;
  filter: string;
  sort: string;
  dir: 'asc' | 'desc';
}

interface UsersToolbarProps extends ToolbarState {
  basePath: string;
  filters: { value: string; label: string }[];
  sorts: { value: string; label: string }[];
  resultCount: number;
}

function buildHref(basePath: string, state: ToolbarState, page = 1): string {
  const sp = new URLSearchParams();
  if (state.search) sp.set('q', state.search);
  if (state.filter && state.filter !== 'all') sp.set('filter', state.filter);
  if (state.sort && state.sort !== 'created_at') sp.set('sort', state.sort);
  if (state.dir === 'asc') sp.set('dir', 'asc');
  if (page > 1) sp.set('page', String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Search, filter and sort controls. State lives in the URL, so the table itself
 * stays a Server Component — no client-side fetch, no loading flash, and the
 * browser back button works.
 */
export default function UsersToolbar({
  basePath,
  filters,
  sorts,
  resultCount,
  search,
  filter,
  sort,
  dir,
}: UsersToolbarProps) {
  const router = useRouter();
  const [term, setTerm] = useState(search);
  const firstRender = useRef(true);

  const navigate = useCallback(
    (next: Partial<ToolbarState>) => {
      const state: ToolbarState = { search: term, filter, sort, dir, ...next };
      // replace, not push: typing should not create a history entry per keystroke.
      router.replace(buildHref(basePath, state));
    },
    [router, basePath, term, filter, sort, dir]
  );

  // Debounce the text input only; chips and selects navigate immediately.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (term === search) return;

    const t = setTimeout(() => navigate({ search: term }), 350);
    return () => clearTimeout(t);
    // navigate is rebuilt on every term change, so depending on it would
    // restart the timer each keystroke and never fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  // Keep the input in sync when the URL changes underneath it (back button).
  useEffect(() => {
    setTerm(prev => (prev === search ? prev : search));
  }, [search]);

  return (
    <div className={styles.toolbar}>
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon}>
          <Search size={16} />
        </span>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search name or email…"
          value={term}
          onChange={e => setTerm(e.target.value)}
          aria-label="Search users"
        />
        {term && (
          <button
            type="button"
            className={styles.searchIcon}
            style={{ left: 'auto', right: 10, cursor: 'pointer', pointerEvents: 'auto' }}
            onClick={() => {
              setTerm('');
              navigate({ search: '' });
            }}
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className={styles.chips}>
        {filters.map(f => (
          <button
            key={f.value}
            type="button"
            className={`${styles.chip} ${filter === f.value ? styles.chipActive : ''}`}
            onClick={() => navigate({ filter: f.value })}
          >
            {f.label}
          </button>
        ))}
      </div>

      <label className={styles.chip} style={{ cursor: 'default', gap: 6 }}>
        <ArrowUpDown size={14} />
        <select
          className={styles.select}
          style={{ border: 'none', background: 'transparent', height: 22 }}
          value={sort}
          onChange={e => navigate({ sort: e.target.value })}
          aria-label="Sort by"
        >
          {sorts.map(s => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          style={{ border: 'none', background: 'transparent', height: 22 }}
          value={dir}
          onChange={e => navigate({ dir: e.target.value as 'asc' | 'desc' })}
          aria-label="Sort direction"
        >
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
      </label>

      <span className={`${styles.chip} ${styles.chipCount}`} style={{ cursor: 'default' }}>
        {resultCount.toLocaleString('id-ID')} results
      </span>
    </div>
  );
}
