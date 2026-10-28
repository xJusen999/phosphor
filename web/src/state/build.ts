'use client';

import { createContext, createElement, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { BuildConfig } from '@phosphor/shared';
import { selectSwitch } from '../audio/switches';

export const DEFAULT_BUILD: BuildConfig = { caseFinish: 'frost', keycaps: 'phosphor', switchType: 'linear' };

type Build = {
  config: BuildConfig;
  setOption<K extends keyof BuildConfig>(key: K, value: BuildConfig[K]): void;
};

const BuildContext = createContext<Build | null>(null);

/** The one build on the page: Build edits it, Order sells it, Sound and Build share its switch. */
export function BuildProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState(DEFAULT_BUILD);
  const setOption = useCallback<Build['setOption']>((key, value) => {
    // Every key press plays the selected switch, so the audio module follows the build.
    if (key === 'switchType') selectSwitch(value as BuildConfig['switchType']);
    setConfig((c) => ({ ...c, [key]: value }));
  }, []);
  const value = useMemo(() => ({ config, setOption }), [config, setOption]);
  return createElement(BuildContext.Provider, { value }, children);
}

export function useBuild(): Build {
  const b = useContext(BuildContext);
  if (!b) throw new Error('useBuild needs a BuildProvider');
  return b;
}
