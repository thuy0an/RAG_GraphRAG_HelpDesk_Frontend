import { Column } from "@ant-design/charts";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import { METRIC_TOOLTIP_TEXT, type ChartMetricDatum } from "../../metrics";

export interface GeneratorMetricsChartProps {
  data: ChartMetricDatum[];
}

// Biểu đồ so sánh nhóm generator metrics giữa PaCRAG và GraphRAG.
// Dữ liệu truyền vào đã ở thang phần trăm để chart chỉ tập trung render.
export function GeneratorMetricsChart({ data }: GeneratorMetricsChartProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 font-semibold text-purple-600">
          <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
          <span>Generator Metrics</span>
        </div>
        <Tooltip title={METRIC_TOOLTIP_TEXT.faithfulness_groundedness}>
          <QuestionCircleOutlined className="text-gray-400" />
        </Tooltip>
      </div>
      {data.length > 0 ? (
        <Column
          data={data}
          xField="metric"
          yField="score"
          seriesField="model"
          isGroup
          height={260}
          yAxis={{ min: 0, max: 100, title: { text: "Điểm (%)" } }}
          legend={{ position: "top" }}
          tooltip={{
            showTitle: true,
            customContent: (_title: string, items?: Array<{ data?: ChartMetricDatum }>) => {
              const item = items?.[0]?.data;
              if (!item || item.score == null) return "";
              return `
                <div style="padding:12px 14px; min-width:240px;">
                  <div style="font-weight:600; margin-bottom:4px;">${item.metric}</div>
                  <div style="font-size:12px; color:#6b7280; margin-bottom:8px; line-height:1.4;">${item.description}</div>
                  <div style="display:flex; justify-content:space-between; gap:12px; font-size:12px;">
                    <span>${item.model}</span>
                    <strong>${item.score.toFixed(1)}%</strong>
                  </div>
                </div>
              `;
            },
          }}
          label={{
            position: "top",
            style: { fontSize: 10 },
            formatter: (datum: ChartMetricDatum) => {
              const score = datum?.score;
              return score != null ? `${score.toFixed(0)}%` : "N/A";
            },
          }}
          colorField="model"
          color={["#2563eb", "#9333ea"]}
        />
      ) : (
        <div className="h-[260px] flex items-center justify-center text-gray-400 text-xs">
          Chưa có đủ dữ liệu Generator metrics để hiển thị biểu đồ.
        </div>
      )}
    </div>
  );
}
