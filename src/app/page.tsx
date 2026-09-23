'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/auth';

export default function RootPage() {
  const router = useRouter();
  // Gate on session, not user: the profile object is still being fetched while
  // a valid session already exists, and redirecting on a null user bounced
  // authenticated visitors back to /sign-in.
  const { session, initialized } = useAuthStore();

  useEffect(() => {
    if (!initialized) return;
    router.replace(session ? '/home' : '/sign-in');
  }, [session, initialized, router]);

  return null; // Redirect page doesn't render anything
}
