import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as authService from '../services/authService.js';
import * as userService from '../services/userService.js';
import * as orderService from '../services/orderService.js';
import * as simulationService from '../services/simulationService.js';
import { getGlobalSession, waitForSessionUpdate } from '../store/memoryStore.js';
import { config } from '../config.js';
import { listCatalogStocks } from '../services/stockCatalog.js';
import { fetchDayBar } from '../stubs/stockPriceApi.js';
import { fetchCandles } from '../services/simulationAgentClient.js';
import { loadAdminConfig } from '../localDb/globalStore.js';

export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'backend-app' });
});

router.post(
  '/auth/signup',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        username: z.string().min(3),
        password: z.string().min(4),
        displayName: z.string().optional(),
      })
      .parse(req.body);
    const result = await authService.signup(body.username, body.password, body.displayName);
    res.status(201).json(result);
  }),
);

router.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        username: z.string().min(1),
        password: z.string().min(1),
        // backward compat
        email: z.string().optional(),
      })
      .parse(req.body);
    const username = body.username || body.email || '';
    const result = await authService.login(username, body.password);
    res.json(result);
  }),
);

router.post(
  '/admin/login',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        username: z.string().min(1),
        password: z.string().min(1),
      })
      .parse(req.body);
    const result = await authService.adminLogin(body.username, body.password);
    res.json(result);
  }),
);

router.get(
  '/admin/overview',
  asyncHandler(async (req, res) => {
    await authService.requireAdmin(req.header('authorization'));
    const cfg = loadAdminConfig();
    res.json({
      config: cfg,
      ...userService.adminMonitor(),
    });
  }),
);

router.post(
  '/admin/simulation/config',
  asyncHandler(async (req, res) => {
    await authService.requireAdmin(req.header('authorization'));
    const body = z
      .object({
        secondsPerMarketMinute: z.number().positive().max(60),
      })
      .parse(req.body);
    const configOut = simulationService.adminUpdateTiming(body.secondsPerMarketMinute);
    res.json(configOut);
  }),
);

router.post(
  '/admin/simulation/start',
  asyncHandler(async (req, res) => {
    await authService.requireAdmin(req.header('authorization'));
    const body = z
      .object({
        marketDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        secondsPerMarketMinute: z.number().positive().max(60).optional(),
      })
      .parse(req.body ?? {});
    const session = await simulationService.adminStartSimulation(body);
    res.status(201).json({ session, config: loadAdminConfig() });
  }),
);

router.post(
  '/admin/simulation/continue',
  asyncHandler(async (req, res) => {
    await authService.requireAdmin(req.header('authorization'));
    const session = await simulationService.adminContinueSimulation();
    res.json({ session });
  }),
);

router.post(
  '/admin/simulation/stop',
  asyncHandler(async (req, res) => {
    await authService.requireAdmin(req.header('authorization'));
    const session = await simulationService.adminStopSimulation();
    res.json({ session });
  }),
);

router.post(
  '/admin/users/reset-all',
  asyncHandler(async (req, res) => {
    await authService.requireAdmin(req.header('authorization'));
    const count = userService.adminResetAll();
    res.json({ resetCount: count });
  }),
);

router.post(
  '/admin/users/:userId/reset',
  asyncHandler(async (req, res) => {
    await authService.requireAdmin(req.header('authorization'));
    const account = userService.adminResetUser(String(req.params.userId));
    res.json({
      user: account.user,
      portfolio: {
        holdings: account.holdings,
        cashBalance: account.user.cashBalance,
        growthHistory: account.growthHistory,
      },
    });
  }),
);

router.get(
  '/user/bootstrap',
  asyncHandler(async (req, res) => {
    const account = await authService.requireUser(req.header('authorization'));
    const data = await userService.getBootstrap(account.user.id);
    res.json(data);
  }),
);

router.post(
  '/user/reset',
  asyncHandler(async (req, res) => {
    const account = await authService.requireUser(req.header('authorization'));
    const fresh = await userService.resetAccount(account.user.id);
    res.json({
      user: fresh.user,
      portfolio: {
        holdings: fresh.holdings,
        cashBalance: fresh.user.cashBalance,
        growthHistory: fresh.growthHistory,
      },
      orders: fresh.orders,
      ledger: fresh.ledger,
      nextSimulationDate: fresh.nextSimulationDate,
    });
  }),
);

router.post(
  '/wallet/deposit',
  asyncHandler(async (req, res) => {
    const account = await authService.requireUser(req.header('authorization'));
    const body = z.object({ amount: z.number().positive() }).parse(req.body);
    const updated = await userService.deposit(account.user.id, body.amount);
    res.json({
      cashBalance: updated.user.cashBalance,
      user: updated.user,
      portfolio: {
        holdings: updated.holdings,
        cashBalance: updated.user.cashBalance,
        growthHistory: updated.growthHistory,
      },
    });
  }),
);

router.post(
  '/orders',
  asyncHandler(async (req, res) => {
    const account = await authService.requireUser(req.header('authorization'));
    const body = z
      .object({
        symbol: z.string().min(1),
        side: z.enum(['BUY', 'SELL']),
        units: z.number().int().positive(),
        kind: z.enum(['PRE_SIMULATION', 'LIVE']),
        simulationCycle: z.number().int().positive().nullable().optional(),
      })
      .parse(req.body);
    const result = await orderService.placeOrder(account.user.id, body);
    res.status(201).json(result);
  }),
);

router.delete(
  '/orders/:orderId',
  asyncHandler(async (req, res) => {
    const account = await authService.requireUser(req.header('authorization'));
    const orderId = String(req.params.orderId);
    const order = await orderService.cancelOrder(account.user.id, orderId);
    res.json({ order });
  }),
);

/** User cannot start/stop — return 403 */
router.post(
  '/simulation/start',
  asyncHandler(async () => {
    throw Object.assign(new Error('Only admin can begin a simulation'), { status: 403 });
  }),
);

router.post(
  '/simulation/continue',
  asyncHandler(async () => {
    throw Object.assign(new Error('Only admin can continue a simulation'), { status: 403 });
  }),
);

router.post(
  '/simulation/stop',
  asyncHandler(async () => {
    throw Object.assign(new Error('Only admin can end a simulation'), { status: 403 });
  }),
);

router.get(
  '/simulation/session',
  asyncHandler(async (req, res) => {
    const account = await authService.requireUser(req.header('authorization'));
    const sinceVersion = Number(req.query.sinceVersion ?? 0);
    const waitMs = Math.min(
      Number(req.query.waitMs ?? config.longPollMaxMs),
      config.longPollMaxMs,
    );

    let session = getGlobalSession();
    if (!session) {
      res.status(204).end();
      return;
    }

    if (session.version <= sinceVersion) {
      session = (await waitForSessionUpdate(session.id, sinceVersion, waitMs)) ?? session;
      session = getGlobalSession() ?? session;
    }

    const bootstrap = await userService.getBootstrap(account.user.id);
    res.json({
      session,
      portfolio: bootstrap.portfolio,
      orders: bootstrap.orders,
      ledger: bootstrap.ledger,
      serverTime: new Date().toISOString(),
    });
  }),
);

router.get(
  '/stocks',
  asyncHandler(async (req, res) => {
    await authService.requireUser(req.header('authorization'));
    const series = typeof req.query.series === 'string' ? req.query.series : undefined;
    const industry = typeof req.query.industry === 'string' ? req.query.industry : undefined;
    const catalog = listCatalogStocks({ series, industry });
    res.json({
      stocks: catalog.map((s) => ({
        symbol: s.symbol,
        name: s.name,
        industry: s.industry,
        series: s.series,
        isin: s.isin,
        exchange: s.exchange,
        hasCsv: s.hasCsv,
      })),
      industries: [...new Set(listCatalogStocks().map((s) => s.industry))].sort(),
      seriesTypes: [...new Set(listCatalogStocks().map((s) => s.series))].sort(),
    });
  }),
);

router.get(
  '/market/candles/:symbol',
  asyncHandler(async (req, res) => {
    await authService.requireUser(req.header('authorization'));
    const symbol = String(req.params.symbol);
    const date = String(req.query.date ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw Object.assign(new Error('Query date=YYYY-MM-DD is required'), { status: 400 });
    }
    const upTo = req.query.upToMinute != null ? Number(req.query.upToMinute) : undefined;
    const bar = await fetchDayBar(symbol, date);
    const seed = Number(req.query.seed ?? 0) || undefined;
    const result = await fetchCandles({
      stockId: symbol,
      date,
      seed,
      upToMinute: Number.isFinite(upTo) ? upTo : undefined,
      dayBar: {
        previous_close: bar.previousClose,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        last: bar.last ?? bar.close,
        close: bar.close,
        vwap: bar.vwap,
        volume: bar.volume,
        turnover: bar.turnover,
        trades: bar.trades,
        deliverable_volume: bar.deliverableVolume,
        deliverable_pct: bar.deliverablePct,
      },
    });
    res.json({
      symbol,
      date,
      candles: result.candles,
      sessionId: result.session_id,
      day: bar,
    });
  }),
);
