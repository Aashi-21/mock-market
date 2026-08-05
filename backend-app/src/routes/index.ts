import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as authService from '../services/authService.js';
import * as userService from '../services/userService.js';
import * as orderService from '../services/orderService.js';
import * as simulationService from '../services/simulationService.js';
import { getSessionByUser, waitForSessionUpdate } from '../store/memoryStore.js';
import { config } from '../config.js';
import { clearSession } from '../store/memoryStore.js';

export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'backend-app' });
});

router.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(1),
      })
      .parse(req.body);
    const result = await authService.login(body.email, body.password);
    res.json(result);
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
    clearSession(account.user.id);
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

router.post(
  '/simulation/start',
  asyncHandler(async (req, res) => {
    const account = await authService.requireUser(req.header('authorization'));
    const session = await simulationService.startSimulation(account.user.id);
    const bootstrap = await userService.getBootstrap(account.user.id);
    res.status(201).json({ ...bootstrap, session });
  }),
);

router.post(
  '/simulation/continue',
  asyncHandler(async (req, res) => {
    const account = await authService.requireUser(req.header('authorization'));
    const session = await simulationService.continueSimulation(account.user.id);
    const bootstrap = await userService.getBootstrap(account.user.id);
    res.json({ ...bootstrap, session });
  }),
);

router.post(
  '/simulation/stop',
  asyncHandler(async (req, res) => {
    const account = await authService.requireUser(req.header('authorization'));
    const result = await simulationService.stopSimulation(account.user.id);
    res.json({
      session: result.session,
      user: result.account.user,
      portfolio: {
        holdings: result.account.holdings,
        cashBalance: result.account.user.cashBalance,
        growthHistory: result.account.growthHistory,
      },
      orders: result.account.orders,
      ledger: result.account.ledger,
    });
  }),
);

/**
 * Long-poll for live session updates.
 * Query: sinceVersion (number), waitMs (optional, capped)
 */
router.get(
  '/simulation/session',
  asyncHandler(async (req, res) => {
    const account = await authService.requireUser(req.header('authorization'));
    const sinceVersion = Number(req.query.sinceVersion ?? 0);
    const waitMs = Math.min(
      Number(req.query.waitMs ?? config.longPollMaxMs),
      config.longPollMaxMs,
    );

    let session = getSessionByUser(account.user.id);
    if (!session) {
      res.status(204).end();
      return;
    }

    if (session.version <= sinceVersion) {
      session = (await waitForSessionUpdate(session.id, sinceVersion, waitMs)) ?? session;
      // If cleared during wait
      const latest = getSessionByUser(account.user.id);
      if (!latest && session.status !== 'ENDED') {
        res.status(204).end();
        return;
      }
      session = latest ?? session;
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
