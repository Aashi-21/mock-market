import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { LiveQuote, SimulationSession, SimulationStatus } from '../types/index.js';
import { EMPTY_PORTFOLIO_START_DATE, MAX_SIMULATION_DAYS } from '../types/index.js';
import { localDbRoot } from './userStore.js';

export interface AdminSimConfig {
  /** Wall-clock seconds that equal one market minute. Default 5 → 5s = 1 min. */
  secondsPerMarketMinute: number;
}

export interface GlobalSimState {
  session: SimulationSession | null;
  config: AdminSimConfig;
}

const DEFAULT_CONFIG: AdminSimConfig = {
  secondsPerMarketMinute: 5,
};

function globalDir(): string {
  return resolve(localDbRoot(), 'global');
}

function configPath(): string {
  return resolve(globalDir(), 'config.json');
}

function sessionPath(): string {
  return resolve(globalDir(), 'session.json');
}

function ensure(): void {
  if (!existsSync(globalDir())) mkdirSync(globalDir(), { recursive: true });
}

export function loadAdminConfig(): AdminSimConfig {
  ensure();
  if (!existsSync(configPath())) return { ...DEFAULT_CONFIG };
  try {
    const raw = JSON.parse(readFileSync(configPath(), 'utf8')) as Partial<AdminSimConfig>;
    const sec = Number(raw.secondsPerMarketMinute);
    return {
      secondsPerMarketMinute:
        Number.isFinite(sec) && sec > 0 ? Math.min(60, Math.max(0.5, sec)) : 5,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveAdminConfig(config: AdminSimConfig): AdminSimConfig {
  ensure();
  const next = {
    secondsPerMarketMinute: Math.min(60, Math.max(0.5, config.secondsPerMarketMinute)),
  };
  writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export function loadPersistedSession(): SimulationSession | null {
  ensure();
  if (!existsSync(sessionPath())) return null;
  try {
    return JSON.parse(readFileSync(sessionPath(), 'utf8')) as SimulationSession;
  } catch {
    return null;
  }
}

export function persistSession(session: SimulationSession | null): void {
  ensure();
  if (!session) {
    writeFileSync(sessionPath(), 'null\n', 'utf8');
    return;
  }
  writeFileSync(sessionPath(), JSON.stringify(session, null, 2), 'utf8');
}

export function createEmptyGlobalSession(
  marketDate: string,
  secondsPerMarketMinute: number,
): Omit<SimulationSession, 'id' | 'version' | 'updatedAt'> {
  return {
    userId: 'global',
    status: 'IDLE',
    startMarketDate: marketDate || EMPTY_PORTFOLIO_START_DATE,
    currentMarketDate: marketDate || EMPTY_PORTFOLIO_START_DATE,
    cycle: 1,
    maxCycles: MAX_SIMULATION_DAYS,
    dayStartedAt: null,
    dayEndsAt: null,
    analysisEndsAt: null,
    tickIndex: 0,
    tickCount: 0,
    quotes: [] as LiveQuote[],
    secondsPerMarketMinute,
  };
}

export type { SimulationStatus };
