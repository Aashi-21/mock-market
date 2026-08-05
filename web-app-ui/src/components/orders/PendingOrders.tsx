import type { Order } from '../../types';
import { formatDate, formatINR } from '../../utils/format';

interface Props {
  orders: Order[];
  onCancel: (orderId: string) => Promise<void>;
}

export function PendingOrders({ orders, onCancel }: Props) {
  const pending = orders.filter(
    (o) => o.status === 'PENDING' && (o.kind === 'PRE_SIMULATION' || o.isPreSimulation),
  );
  const recent = orders
    .filter((o) => !(o.status === 'PENDING' && (o.kind === 'PRE_SIMULATION' || o.isPreSimulation)))
    .slice(0, 6);

  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">Orders</h2>
          <p className="panel__subtitle">Pre-simulation queue and recent fills</p>
        </div>
      </div>

      {pending.length === 0 && recent.length === 0 ? (
        <p className="empty-state">No orders yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Symbol</th>
                <th className="num">Units</th>
                <th className="num">Price</th>
                <th>Status</th>
                <th>When</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pending.map((order) => (
                <OrderRow key={order.id} order={order} onCancel={onCancel} />
              ))}
              {recent.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function OrderRow({
  order,
  onCancel,
}: {
  order: Order;
  onCancel?: (orderId: string) => Promise<void>;
}) {
  return (
    <tr>
      <td>
        <span className={`side-tag side-tag--${order.side.toLowerCase()}`}>{order.side}</span>
        {(order.kind === 'PRE_SIMULATION' || order.isPreSimulation) && (
          <span className="pre-tag">pre</span>
        )}
        {order.kind === 'LIVE' && <span className="pre-tag">live</span>}
      </td>
      <td>
        <span className="symbol-chip">{order.symbol}</span>
      </td>
      <td className="num mono">{order.units}</td>
      <td className="num mono">
        {order.fillPrice != null
          ? formatINR(order.fillPrice)
          : order.limitPrice
            ? formatINR(order.limitPrice)
            : '—'}
      </td>
      <td>
        <span className={`status-tag status-tag--${order.status.toLowerCase()}`}>
          {order.status}
        </span>
      </td>
      <td className="muted">{formatDate(order.placedAt.slice(0, 10))}</td>
      <td>
        {onCancel && order.status === 'PENDING' && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => void onCancel(order.id)}
          >
            Cancel
          </button>
        )}
      </td>
    </tr>
  );
}
