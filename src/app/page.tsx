'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/auth';

export default function RootPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      router.replace('/home');
    } else {
      router.replace('/sign-in');
    }
  }, [user, router]);

  return null; // Redirect page doesn't render anything
}
