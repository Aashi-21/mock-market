import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  CatalogStock,
  LedgerEntry,
  Order,
  OrderSide,
  Portfolio,
  SimulationPhase,
  SimulationSession,
  Stock,
} from '../types';
import * as marketApi from '../services/marketApi';
import { config } from '../config';
import { useAuth } from './AuthContext';

interface AppDataContextValue {
  portfolio: Portfolio | null;
  orders: Order[];
  ledger: LedgerEntry[];
  marketDate: string | null;
  nextSimulationDate: string | null;
  simulationStocks: Stock[];
  catalogStocks: CatalogStock[];
  session: SimulationSession | null;
  phase: SimulationPhase;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  placeOrder: (input: {
    symbol: string;
    side: OrderSide;
    units: number;
    isPreSimulation: boolean;
  }) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  beginSimulation: () => Promise<void>;
  continueSimulation: () => Promise<void>;
  endSimulation: () => Promise<void>;
  resetAccount: () => Promise<void>;
  deposit: (amount: number) => Promise<void>;
  clearError: () => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function phaseFromSession(session: SimulationSession | null): SimulationPhase {
  if (!session || session.status === 'IDLE' || session.status === 'ENDED') {
    return 'PRE_SIMULATION';
  }
  if (session.status === 'TRADING') return 'TRADING';
  if (session.status === 'ANALYSIS') return 'ANALYSIS';
  return 'PRE_SIMULATION';
}

function applyBootstrap(
  data: marketApi.BootstrapResponse,
  setters: {
    setPortfolio: (p: Portfolio) => void;
    setOrders: (o: Order[]) => void;
    setLedger: (l: LedgerEntry[]) => void;
    setMarketDate: (d: string | null) => void;
    setNextSimulationDate: (d: string | null) => void;
    setSession: (s: SimulationSession | null) => void;
    setSimulationStocks: (s: Stock[]) => void;
    setCatalogStocks: (s: CatalogStock[]) => void;
  },
) {
  setters.setPortfolio(data.portfolio);
  setters.setOrders(data.orders);
  setters.setLedger(data.ledger);
  setters.setNextSimulationDate(data.nextSimulationDate);
  setters.setSession(data.session);
  if (data.stocks) setters.setCatalogStocks(data.stocks);
  if (data.session) {
    setters.setMarketDate(data.session.currentMarketDate);
    setters.setSimulationStocks(data.session.quotes);
  } else {
    setters.setMarketDate(data.nextSimulationDate);
    setters.setSimulationStocks([]);
  }
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, token } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [marketDate, setMarketDate] = useState<string | null>(null);
  const [nextSimulationDate, setNextSimulationDate] = useState<string | null>(null);
  const [simulationStocks, setSimulationStocks] = useState<Stock[]>([]);
  const [catalogStocks, setCatalogStocks] = useState<CatalogStock[]>([]);
  const [session, setSession] = useState<SimulationSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollAbort = useRef(false);
  const sessionVersion = useRef(0);

  const setters = useMemo(
    () => ({
      setPortfolio,
      setOrders,
      setLedger,
      setMarketDate,
      setNextSimulationDate,
      setSession,
      setSimulationStocks,
      setCatalogStocks,
    }),
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await marketApi.fetchBootstrap();
      applyBootstrap(data, setters);
      sessionVersion.current = data.session?.version ?? 0;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [setters]);

  useEffect(() => {
    if (isAuthenticated && token) {
      void refresh();
    } else {
      setPortfolio(null);
      setOrders([]);
      setLedger([]);
      setMarketDate(null);
      setNextSimulationDate(null);
      setSimulationStocks([]);
      setCatalogStocks([]);
      setSession(null);
    }
  }, [isAuthenticated, token, refresh]);

  // Poll global session: detect admin start while idle, and stream ticks while live
  useEffect(() => {
    if (!isAuthenticated) return;

    pollAbort.current = false;

    async function loop() {
      while (!pollAbort.current) {
        try {
          const active =
            sessionVersion.current > 0 ||
            true; /* always try — 204 when idle */
          void active;
          const data = await marketApi.pollSession(
            sessionVersion.current,
            config.longPollWaitMs,
          );
          if (pollAbort.current) break;
          if (!data) {
            setSession(null);
            setSimulationStocks([]);
            sessionVersion.current = 0;
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          sessionVersion.current = data.session.version;
          setSession(data.session);
          setPortfolio(data.portfolio);
          setOrders(data.orders);
          setLedger(data.ledger);
          setMarketDate(data.session.currentMarketDate);
          setSimulationStocks(data.session.quotes);
          if (data.session.status === 'ENDED') {
            setSession(null);
            setSimulationStocks([]);
            sessionVersion.current = 0;
            await refresh();
          }
        } catch {
          if (pollAbort.current) break;
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

    void loop();
    return () => {
      pollAbort.current = true;
    };
  }, [isAuthenticated, refresh]);

  const placeOrder = useCallback(
    async (input: {
      symbol: string;
      side: OrderSide;
      units: number;
      isPreSimulation: boolean;
    }) => {
      setError(null);
      try {
        const result = await marketApi.placeOrder({
          symbol: input.symbol,
          side: input.side,
          units: input.units,
          kind: input.isPreSimulation ? 'PRE_SIMULATION' : 'LIVE',
          simulationCycle: session?.cycle ?? null,
        });
        setPortfolio(result.portfolio);
        if (result.session) {
          setSession(result.session);
          setSimulationStocks(result.session.quotes);
          setMarketDate(result.session.currentMarketDate);
          sessionVersion.current = result.session.version;
        }
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Order failed';
        setError(message);
        throw err;
      }
    },
    [refresh, session?.cycle],
  );

  const cancelOrder = useCallback(
    async (orderId: string) => {
      setError(null);
      try {
        await marketApi.cancelOrder(orderId);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Cancel failed';
        setError(message);
        throw err;
      }
    },
    [refresh],
  );

  const beginSimulation = useCallback(async () => {
    setError('Only the admin can begin a simulation (/admin/login).');
    throw new Error('Only the admin can begin a simulation');
  }, []);

  const continueSimulation = useCallback(async () => {
    setError('Only the admin can continue a simulation.');
    throw new Error('Only the admin can continue a simulation');
  }, []);

  const endSimulation = useCallback(async () => {
    setError('Only the admin can end a simulation.');
    throw new Error('Only the admin can end a simulation');
  }, []);

  const resetAccount = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await marketApi.resetAccount();
      applyBootstrap(data, setters);
      sessionVersion.current = 0;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setters]);

  const deposit = useCallback(
    async (amount: number) => {
      setError(null);
      try {
        const data = await marketApi.deposit(amount);
        setPortfolio(data.portfolio);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Deposit failed';
        setError(message);
        throw err;
      }
    },
    [refresh],
  );

  const phase = phaseFromSession(session);

  const value = useMemo<AppDataContextValue>(
    () => ({
      portfolio: portfolio
        ? {
            ...portfolio,
            cashBalance: portfolio.cashBalance ?? user?.cashBalance ?? 0,
          }
        : null,
      orders,
      ledger,
      marketDate,
      nextSimulationDate,
      simulationStocks,
      catalogStocks,
      session,
      phase,
      loading,
      error,
      refresh,
      placeOrder,
      cancelOrder,
      beginSimulation,
      continueSimulation,
      endSimulation,
      resetAccount,
      deposit,
      clearError: () => setError(null),
    }),
    [
      portfolio,
      user?.cashBalance,
      orders,
      ledger,
      marketDate,
      nextSimulationDate,
      simulationStocks,
      catalogStocks,
      session,
      phase,
      loading,
      error,
      refresh,
      placeOrder,
      cancelOrder,
      beginSimulation,
      continueSimulation,
      endSimulation,
      resetAccount,
      deposit,
    ],
  );

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
