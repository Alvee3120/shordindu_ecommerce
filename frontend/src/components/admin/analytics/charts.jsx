"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBDT, formatNumber } from "@/lib/format";

export const PRIMARY = "#003333";
export const MOON = "#f4a648";

export const STATUS_COLORS = {
  pending: "#f59e0b",
  confirmed: "#06b6d4",
  processing: "#3b82f6",
  shipped: "#6366f1",
  delivered: "#10b981",
  cancelled: "#ef4444",
};

export const ORDER_STATUS_ORDER = ["confirmed", "processing", "shipped", "delivered", "cancelled", "pending"];

export const METRIC_CONFIG = {
  revenue: { key: "revenue", label: "Revenue", format: formatBDT },
  orders: { key: "orders", label: "Orders", format: formatNumber },
  units: { key: "units", label: "Units sold", format: formatNumber },
  aov: { key: "aov", label: "Avg order value", format: formatBDT },
};

const AXIS_TICK = { fontSize: 11, fill: "#737373" };

function compact(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  if (Math.abs(number) >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (Math.abs(number) >= 1000) return `${(number / 1000).toFixed(number % 1000 === 0 ? 0 : 1)}k`;
  return `${number}`;
}

function MetricTooltip({ active, payload, label, metric }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-neutral-800">{label}</p>
      <p className="text-neutral-600">
        {metric.label}: <span className="font-medium text-neutral-900">{metric.format(point[metric.key])}</span>
      </p>
      <p className="text-neutral-500">Orders: {formatNumber(point.orders)}</p>
      <p className="text-neutral-500">Revenue: {formatBDT(point.revenue)}</p>
    </div>
  );
}

export function RevenueTrendChart({ points, metric = "revenue" }) {
  const config = METRIC_CONFIG[metric] ?? METRIC_CONFIG.revenue;
  const gradientId = `grad-${config.key}`;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.28} />
            <stop offset="95%" stopColor={PRIMARY} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} tickFormatter={compact} />
        <Tooltip content={<MetricTooltip metric={config} />} />
        <Area
          type="monotone"
          dataKey={config.key}
          stroke={PRIMARY}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SalesComparisonChart({ points, metric = "revenue" }) {
  const config = METRIC_CONFIG[metric] ?? METRIC_CONFIG.revenue;
  const prevKey = `prev_${config.key}`;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} tickFormatter={compact} />
        <Tooltip
          formatter={(value, name) => [config.format(value), name]}
          labelClassName="text-xs font-semibold"
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey={config.key} name="Selected period" stroke={PRIMARY} strokeWidth={2} dot={false} />
        <Line
          type="monotone"
          dataKey={prevKey}
          name="Previous period"
          stroke={MOON}
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function OrdersTrendChart({ points }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
          labelClassName="text-xs font-semibold"
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {ORDER_STATUS_ORDER.map((status) => (
          <Area
            key={status}
            type="monotone"
            dataKey={status}
            stackId="orders"
            stroke={STATUS_COLORS[status]}
            fill={STATUS_COLORS[status]}
            fillOpacity={0.55}
            strokeWidth={1.5}
            name={status}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function OrderStatusChart({ data, onSelect }) {
  if (!data?.length) return null;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="status"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
          cursor={onSelect ? "pointer" : "default"}
        >
          {data.map((entry) => (
            <Cell
              key={entry.status}
              fill={STATUS_COLORS[entry.status] || "#a3a3a3"}
              onClick={() => onSelect?.(entry.status)}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name, item) => [`${value} (${item.payload.pct}%)`, name]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CategoryBarChart({ data, dataKey = "net_sales", limit = 8, formatValue = formatBDT }) {
  const chartData = [...(data || [])]
    .sort((a, b) => Number(b[dataKey]) - Number(a[dataKey]))
    .slice(0, limit)
    .map((item) => ({ name: item.name, value: Number(item[dataKey]) }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
        <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={compact} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: "#525252" }}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Tooltip
          formatter={(value) => formatValue(value)}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
        />
        <Bar dataKey="value" fill={PRIMARY} radius={[0, 4, 4, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Sales volume analysis: units + orders on the left axis, average order value
 * on a right axis. Answers a different question from the Overview's revenue
 * trend (which only plots one metric).
 */
export function VolumeTrendChart({ points }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis yAxisId="volume" tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
        <YAxis
          yAxisId="aov"
          orientation="right"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={54}
          tickFormatter={compact}
        />
        <Tooltip
          formatter={(value, name) => [name === "Avg order value" ? formatBDT(value) : formatNumber(value), name]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
          labelClassName="text-xs font-semibold"
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line yAxisId="volume" type="monotone" dataKey="units" name="Units sold" stroke={PRIMARY} strokeWidth={2} dot={false} />
        <Line yAxisId="volume" type="monotone" dataKey="orders" name="Orders" stroke={MOON} strokeWidth={2} dot={false} />
        <Line
          yAxisId="aov"
          type="monotone"
          dataKey="aov"
          name="Avg order value"
          stroke="#94a3b8"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Period new vs returning customers (from the customer summary totals). */
export function NewVsReturningChart({ newCount = 0, returningCount = 0 }) {
  const total = newCount + returningCount;
  if (!total) return null;
  const data = [
    { name: "New", value: newCount },
    { name: "Returning", value: returningCount },
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
          <Cell fill={PRIMARY} />
          <Cell fill={MOON} />
        </Pie>
        <Tooltip
          formatter={(value, name) => [`${value} (${total ? Math.round((value / total) * 100) : 0}%)`, name]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CustomerGrowthChart({ points }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="count" name="New customers" stroke={PRIMARY} strokeWidth={2} dot={false} />
        <Line
          type="monotone"
          dataKey="prev_count"
          name="Previous period"
          stroke={MOON}
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
