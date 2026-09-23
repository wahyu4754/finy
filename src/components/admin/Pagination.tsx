import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './Admin.module.css';

interface PaginationProps {
  page: number;
  pageSize: number;
  count: number;
  /** Builds an href for a page number, preserving every other query param. */
  hrefFor: (page: number) => string;
}

/** Window of page numbers around the current one: 1 … 4 [5] 6 … 20 */
function pageWindow(page: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '…')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);

  if (start > 2) pages.push('…');
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push('…');

  pages.push(total);
  return pages;
}

export default function Pagination({ page, pageSize, count, hrefFor }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);

  return (
    <div className={styles.pagination}>
      <span className={styles.paginationInfo}>
        Showing <strong className={styles.mono}>{from}</strong>–
        <strong className={styles.mono}>{to}</strong> of{' '}
        <strong className={styles.mono}>{count.toLocaleString('id-ID')}</strong>
      </span>

      <nav className={styles.paginationNav} aria-label="Pagination">
        {page > 1 ? (
          <Link className={styles.pageBtn} href={hrefFor(page - 1)} aria-label="Previous page">
            <ChevronLeft size={16} />
          </Link>
        ) : (
          <span className={`${styles.pageBtn} ${styles.pageBtnDisabled}`}>
            <ChevronLeft size={16} />
          </span>
        )}

        {pageWindow(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className={styles.pageEllipsis}>
              …
            </span>
          ) : p === page ? (
            <span key={p} className={`${styles.pageBtn} ${styles.pageBtnActive}`}>
              {p}
            </span>
          ) : (
            <Link key={p} className={styles.pageBtn} href={hrefFor(p)}>
              {p}
            </Link>
          )
        )}

        {page < totalPages ? (
          <Link className={styles.pageBtn} href={hrefFor(page + 1)} aria-label="Next page">
            <ChevronRight size={16} />
          </Link>
        ) : (
          <span className={`${styles.pageBtn} ${styles.pageBtnDisabled}`}>
            <ChevronRight size={16} />
          </span>
        )}
      </nav>
    </div>
  );
}
