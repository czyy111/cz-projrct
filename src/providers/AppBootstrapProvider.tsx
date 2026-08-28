import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { ensureDatabaseReady } from '../database/client';
import { reconcileNotifications } from '../notifications/service';

type BootstrapState =
  | { status: 'loading'; message: string }
  | { status: 'ready'; message: string }
  | { status: 'error'; message: string };

const BootstrapContext = createContext<BootstrapState>({ status: 'loading', message: '正在准备本地数据…' });

export function AppBootstrapProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<BootstrapState>({ status: 'loading', message: '正在准备本地数据…' });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await ensureDatabaseReady();
        void reconcileNotifications();
        if (active) {
          setState({
            status: 'ready',
            message: result.recoveredFromBackup ? '已从本地备份恢复数据' : '本地数据已就绪',
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '本地数据初始化失败';
        if (active) setState({ status: 'error', message });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <BootstrapContext.Provider value={value}>{children}</BootstrapContext.Provider>;
}

export function useBootstrapState() {
  return useContext(BootstrapContext);
}
