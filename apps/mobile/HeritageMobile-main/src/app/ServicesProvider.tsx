import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Services } from '../services/contracts';
import { getRepository, getServices } from '../services';
import { Repository } from '../storage/repository';

interface Ctx {
  services: Services;
  repo: Repository;
  hydrated: boolean;
}

const ServicesContext = createContext<Ctx | null>(null);

export function ServicesProvider({ children, override }: { children: React.ReactNode; override?: { services: Services; repo: Repository } }) {
  const repo = override?.repo ?? getRepository();
  const services = override?.services ?? getServices();
  const [hydrated, setHydrated] = useState(repo.isHydrated);
  useEffect(() => {
    let mounted = true;
    repo.hydrate().then(() => mounted && setHydrated(true));
    return () => {
      mounted = false;
    };
  }, [repo]);
  const value = useMemo(() => ({ services, repo, hydrated }), [services, repo, hydrated]);
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useServices must be used within ServicesProvider');
  return ctx.services;
}

export function useRepository(): Repository {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useRepository must be used within ServicesProvider');
  return ctx.repo;
}

export function useHydrated(): boolean {
  const ctx = useContext(ServicesContext);
  return ctx?.hydrated ?? false;
}
