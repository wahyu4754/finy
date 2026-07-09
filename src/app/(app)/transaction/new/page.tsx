'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransactionStore } from '../../../../store/transactions';

function RedirectHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('editId');
  const { setAddTxOpen, setEditTxId } = useTransactionStore();

  useEffect(() => {
    if (editId) {
      setEditTxId(editId);
    }
    setAddTxOpen(true);
    router.replace('/home');
  }, [router, editId, setAddTxOpen, setEditTxId]);

  return null;
}

export default function NewTransactionRedirectPage() {
  return (
    <Suspense fallback={null}>
      <RedirectHandler />
    </Suspense>
  );
}
