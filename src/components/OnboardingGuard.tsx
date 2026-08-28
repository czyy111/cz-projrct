import { useEffect, useState, type PropsWithChildren } from 'react';
import { useRouter, useSegments } from 'expo-router';

import { getPreference } from '../repositories/preferences';

export function OnboardingGuard({ children }: PropsWithChildren) {
  const router = useRouter();
  const segments = useSegments();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    void getPreference<boolean>('onboarding.completed').then((complete) => {
      if (!active) return;
      if (!complete && segments[0] !== 'onboarding') router.replace('/onboarding');
      setChecked(true);
    });
    return () => { active = false; };
  }, [router, segments]);

  return checked ? children : null;
}
