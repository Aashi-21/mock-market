import { createId } from '../utils/helpers.js';
import { getAccount, getSessionByUser, persistAccount, upsertOrder } from '../store/memoryStore.js';
import type { Order, OrderKind, OrderSide } from '../types/index.js';
import { validateOrderIntent } from './portfolioMath.js';
import { executeLiveOrder } from './simulationService.js';
import { fetchDayBar, getStockMeta } from '../stubs/stockPriceApi.js';
import { resolveSimulationStartDate } from './simulationService.js';

export async function placeOrder(
  userId: string,
  input: {
    symbol: string;
    side: OrderSide;
    units: number;
    kind: OrderKind;
    simulationCycle?: number | null;
  },
) {
  const symbol = input.symbol.toUpperCase();
  if (!getStockMeta(symbol)) {
    throw Object.assign(new Error(`Unknown NSE symbol: ${symbol}`), { status: 400 });
  }

  const account = await getAccount(userId);
  const session = getSessionByUser(userId);

  if (input.kind === 'LIVE') {
    if (!session || session.status !== 'TRADING') {
      throw Object.assign(new Error('LIVE orders require an active trading day'), { status: 400 });
    }
    const quote = session.quotes.find((q) => q.symbol === symbol);
    if (!quote) {
      throw Object.assign(new Error('Symbol not on the simulation board'), { status: 400 });
    }
    validateOrderIntent(account, input.side, symbol, input.units, quote.lastPrice);

    const order: Order = {
      id: createId('ord'),
      userId,
      symbol,
      side: input.side,
      units: input.units,
      kind: 'LIVE',
      status: 'PENDING',
      simulationCycle: session.cycle,
      fillPrice: null,
      placedAt: new Date().toISOString(),
      filledAt: null,
    };

    const result = await executeLiveOrder(userId, order);
    return {
      order: result.order,
      portfolio: {
        holdings: result.account.holdings,
        cashBalance: result.account.user.cashBalance,
        growthHistory: result.account.growthHistory,
      },
      session: result.session,
    };
  }

  // PRE_SIMULATION — queue until simulation starts
  if (session && (session.status === 'TRADING' || session.status === 'ANALYSIS')) {
    throw Object.assign(new Error('Cannot queue pre-simulation orders during an active session'), {
      status: 400,
    });
  }

  const startDate = resolveSimulationStartDate(account);
  const bar = await fetchDayBar(symbol, startDate);
  validateOrderIntent(account, input.side, symbol, input.units, bar.open);

  const order: Order = {
    id: createId('ord'),
    userId,
    symbol,
    side: input.side,
    units: input.units,
    kind: 'PRE_SIMULATION',
    status: 'PENDING',
    simulationCycle: input.simulationCycle ?? null,
    fillPrice: null,
    placedAt: new Date().toISOString(),
    filledAt: null,
  };
  upsertOrder(account, order);
  await persistAccount(account);

  return {
    order,
    portfolio: {
      holdings: account.holdings,
      cashBalance: account.user.cashBalance,
      growthHistory: account.growthHistory,
    },
    session: null,
  };
}

export async function cancelOrder(userId: string, orderId: string) {
  const account = await getAccount(userId);
  const order = account.orders.find((o) => o.id === orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (order.status !== 'PENDING' || order.kind !== 'PRE_SIMULATION') {
    throw Object.assign(new Error('Only pending pre-simulation orders can be cancelled'), {
      status: 400,
    });
  }
  order.status = 'CANCELLED';
  await persistAccount(account);
  return order;
}
