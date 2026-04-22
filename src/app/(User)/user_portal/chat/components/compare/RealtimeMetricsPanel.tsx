import { useMemo } from "react";
import type { CompareRun, QueryMetrics } from "../../types";
import { readGeneratorScores } from "../../metrics";

interface RealtimeMetricsPanelProps {
  runs: CompareRun[];
  activeRun: CompareRun | null;
  isLive: boolean;
}

interface Point {
  x: number;
  y: number;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function compactSeries(values: Array<number | null>, max = 12): number[] {
  return values.filter((v): v is number => v != null).slice(-max);
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function maxOf(values: number[], fallback = 1): number {
  if (!values.length) return fallback;
  return Math.max(...values, fallback);
}

function formatValue(value: number | null, digits = 2, suffix = ""): string {
  if (value == null) return "N/A";
  return `${value.toFixed(digits)}${suffix}`;
}

function sparkPoints(values: number[]): Point[] {
  if (!values.length) return [];
  const max = maxOf(values);
  // Chuẩn hóa dữ liệu về hệ trục 0..100 để vẽ sparkline đơn giản, nhẹ.
  return values.map((v, idx) => ({
    x: values.length === 1 ? 0 : (idx / (values.length - 1)) * 100,
    y: 100 - (v / max) * 100,
  }));
}

function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  const points = useMemo(() => sparkPoints(values), [values]);
  if (points.length < 2) {
    return <div className="h-12 rounded-md bg-gray-50 border border-gray-100" />;
  }

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const dots = points.map((p, i) => (
    <circle key={i} cx={p.x} cy={p.y} r={1.8} fill={stroke} />
  ));

  return (
    <svg viewBox="0 0 100 100" className="h-12 w-full rounded-md bg-gray-50 border border-gray-100 p-1">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={polyline}
      />
      {dots}
    </svg>
  );
}

function accuracyProxy(metric: QueryMetrics | null | undefined): number | null {
  // Dùng answer_correctness làm accuracy proxy realtime (không thay thế benchmark offline).
  const generation = readGeneratorScores(metric);
  const score = toNumber(generation.answer_correctness);
  return score == null ? null : score * 100;
}

function ResourceBar({ label, value, max, colorClass }: { label: string; value: number | null; max: number; colorClass: string }) {
  const normalized = value != null && max > 0 ? Math.min(max, value) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <span>{label}</span>
        <span className="font-medium text-gray-700">{value == null ? "N/A" : value.toFixed(0)}</span>
      </div>
      <progress className={`w-full h-2 rounded-full overflow-hidden ${colorClass}`} value={normalized} max={max} />
    </div>
  );
}

export function RealtimeMetricsPanel({ runs, activeRun, isLive }: RealtimeMetricsPanelProps) {
  const sortedRuns = useMemo(() => {
    // Sắp xếp theo thời gian để biểu đồ thể hiện đúng xu hướng theo phiên làm việc.
    const copied = [...runs];
    copied.sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return ta - tb;
    });
    return copied;
  }, [runs]);

  const latencyPacSeries = useMemo(
    () => compactSeries(sortedRuns.map((r) => toNumber(r.pac_query?.time_total_s))),
    [sortedRuns]
  );
  const latencyGraphSeries = useMemo(
    () => compactSeries(sortedRuns.map((r) => toNumber(r.graphrag_query?.time_total_s))),
    [sortedRuns]
  );

  const accuracyPacSeries = useMemo(
    () => compactSeries(sortedRuns.map((r) => accuracyProxy(r.pac_query))),
    [sortedRuns]
  );
  const accuracyGraphSeries = useMemo(
    () => compactSeries(sortedRuns.map((r) => accuracyProxy(r.graphrag_query))),
    [sortedRuns]
  );

  const latestPacLatency = toNumber(activeRun?.pac_query?.time_total_s) ?? (latencyPacSeries.at(-1) ?? null);
  const latestGraphLatency = toNumber(activeRun?.graphrag_query?.time_total_s) ?? (latencyGraphSeries.at(-1) ?? null);
  const latestPacAccuracy = accuracyProxy(activeRun?.pac_query) ?? (accuracyPacSeries.at(-1) ?? null);
  const latestGraphAccuracy = accuracyProxy(activeRun?.graphrag_query) ?? (accuracyGraphSeries.at(-1) ?? null);

  const latestPacTokens = toNumber(activeRun?.pac_query?.answer_tokens);
  const latestGraphTokens = toNumber(activeRun?.graphrag_query?.answer_tokens);
  const latestPacChunks = toNumber(activeRun?.pac_query?.retrieved_chunk_count);
  const latestGraphChunks = toNumber(activeRun?.graphrag_query?.retrieved_chunk_count);

  const tokenMax = maxOf(compactSeries([
    ...sortedRuns.map((r) => toNumber(r.pac_query?.answer_tokens)),
    ...sortedRuns.map((r) => toNumber(r.graphrag_query?.answer_tokens)),
  ]), 100);

  const chunkMax = maxOf(compactSeries([
    ...sortedRuns.map((r) => toNumber(r.pac_query?.retrieved_chunk_count)),
    ...sortedRuns.map((r) => toNumber(r.graphrag_query?.retrieved_chunk_count)),
  ]), 20);

  const hasData = sortedRuns.some((r) => r.pac_query || r.graphrag_query);

  return (
    <div className="mx-4 mb-6 rounded-2xl smartchatbot-frame">
      <div className="px-4 py-3 border-b border-gray-200 bg-white rounded-t-2xl flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Dashboard Metrics Realtime</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Latency, accuracy proxy, resource usage theo các query gần nhất</div>
        </div>
        <div className={`text-[11px] font-medium px-2 py-1 rounded-full ${isLive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
          {isLive ? "LIVE" : "IDLE"}
        </div>
      </div>

      {!hasData ? (
        <div className="p-6 text-xs text-gray-400 text-center">Chưa có dữ liệu metrics realtime. Hãy gửi query để bắt đầu theo dõi.</div>
      ) : (
        <div className="p-4 space-y-4 text-xs">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 space-y-2">
              <div className="font-semibold text-blue-700">Xu hướng độ trễ (Latency)</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-gray-500">PaCRAG hiện tại</div>
                  <div className="font-semibold text-gray-800">{formatValue(latestPacLatency, 2, "s")}</div>
                  <div className="text-[10px] text-gray-500">TB: {formatValue(mean(latencyPacSeries), 2, "s")}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">GraphRAG hiện tại</div>
                  <div className="font-semibold text-gray-800">{formatValue(latestGraphLatency, 2, "s")}</div>
                  <div className="text-[10px] text-gray-500">TB: {formatValue(mean(latencyGraphSeries), 2, "s")}</div>
                </div>
              </div>
              <Sparkline values={[...latencyPacSeries, ...latencyGraphSeries]} stroke="#2563eb" />
              <div className="text-[10px] text-blue-700/80">
                Vai trò: theo dõi tốc độ phản hồi theo thời gian để phát hiện lúc hệ thống chậm bất thường.
              </div>
            </div>

            <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-3 space-y-2">
              <div className="font-semibold text-purple-700">Xu hướng độ đúng tương đối (Accuracy Proxy)</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-gray-500">PaCRAG hiện tại</div>
                  <div className="font-semibold text-gray-800">{formatValue(latestPacAccuracy, 1, "%")}</div>
                  <div className="text-[10px] text-gray-500">TB: {formatValue(mean(accuracyPacSeries), 1, "%")}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500">GraphRAG hiện tại</div>
                  <div className="font-semibold text-gray-800">{formatValue(latestGraphAccuracy, 1, "%")}</div>
                  <div className="text-[10px] text-gray-500">TB: {formatValue(mean(accuracyGraphSeries), 1, "%")}</div>
                </div>
              </div>
              <Sparkline values={[...accuracyPacSeries, ...accuracyGraphSeries]} stroke="#7c3aed" />
              <div className="text-[10px] text-purple-700/80">
                Vai trò: quan sát chất lượng câu trả lời theo thời gian để biết pipeline nào ổn định hơn.
              </div>
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3 space-y-3">
              <div className="font-semibold text-amber-700">Mức sử dụng tài nguyên (Resource Usage)</div>
              <ResourceBar label="PaCRAG token load" value={latestPacTokens} max={tokenMax} colorClass="bg-blue-500" />
              <ResourceBar label="GraphRAG token load" value={latestGraphTokens} max={tokenMax} colorClass="bg-purple-500" />
              <ResourceBar label="PaCRAG context load" value={latestPacChunks} max={chunkMax} colorClass="bg-emerald-500" />
              <ResourceBar label="GraphRAG context load" value={latestGraphChunks} max={chunkMax} colorClass="bg-orange-500" />
              <div className="text-[10px] text-gray-500 pt-1 border-t border-amber-100">
                Resource usage được hiển thị theo proxy: answer tokens và retrieved chunks.
              </div>
              <div className="text-[10px] text-amber-700/80">
                Vai trò: theo dõi tải xử lý để cân bằng giữa tốc độ, chất lượng và chi phí vận hành.
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
