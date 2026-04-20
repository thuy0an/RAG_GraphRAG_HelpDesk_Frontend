// Centralized copy for compare-metric explanations.
// Keeping these texts in one place avoids drift across AI chat and full workspace screens.

export interface MetricExplanationItem {
  label: string;
  description: string;
}

export const METRIC_EXPLANATION_ITEMS: MetricExplanationItem[] = [
  {
    label: "Context Relevance",
    description: "Đo mức độ các đoạn truy xuất có thật sự liên quan đến câu hỏi.",
  },
  {
    label: "Context Recall",
    description: "Đo khả năng tìm đủ thông tin cần thiết trong kho tri thức để trả lời.",
  },
  {
    label: "Context Precision",
    description: "Đo việc các tài liệu liên quan có được xếp cao trong top-K kết quả hay không.",
  },
  {
    label: "Faithfulness/Groundedness",
    description: "Đo câu trả lời có bám sát ngữ cảnh truy xuất hay không, hạn chế hallucination.",
  },
  {
    label: "Answer Relevancy",
    description: "Đo câu trả lời có giải quyết trực tiếp câu hỏi của người dùng hay không.",
  },
  {
    label: "Answer Correctness",
    description: "Đo mức độ đúng của câu trả lời so với ground truth hoặc giá trị proxy tương ứng.",
  },
];
