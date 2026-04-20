import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { Image, Tooltip } from "antd";
import { FileTextOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { MessageFormatter } from "./formatters";
import { Utility } from "./utils";
import type { CitationModalState, Message } from "./types";

// Render một dòng metric với highlight tùy chọn khi metric đó tốt hơn.
// Mục tiêu là giữ định dạng cell đồng nhất cho mọi màn so sánh.
export function MetricRow({
  label,
  value,
  better,
  labelTooltipText,
}: {
  label: string;
  value: string | null;
  better?: boolean;
  labelTooltipText?: string;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <MetricLabelWithTooltip label={label} tooltipText={labelTooltipText} />
      {value == null ? (
        <span className="text-gray-300">-</span>
      ) : (
        <span className={`flex items-center gap-1 font-medium ${better ? "text-green-600" : "text-gray-700"}`}>
          {value}
          {better && <span className="text-[9px] text-green-600 font-semibold">✓</span>}
        </span>
      )}
    </div>
  );
}

// Hiển thị nhãn metric kèm tooltip giải thích khi có mô tả.
export function MetricLabelWithTooltip({ label, tooltipText }: { label: string; tooltipText?: string }) {
  if (!tooltipText) {
    return <span className="text-gray-500">{label}</span>;
  }

  return (
    <Tooltip title={tooltipText}>
      <span className="inline-flex items-center gap-1 text-gray-500 cursor-help">
        {label}
        <QuestionCircleOutlined className="text-gray-400" />
      </span>
    </Tooltip>
  );
}

// Badge trực quan để đánh dấu cột/giá trị đang tốt hơn trong so sánh 2 hệ.
export function QualityBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
      ✓ Tốt hơn
    </span>
  );
}

// Quy đổi confidence sang dải màu ngữ nghĩa để người đọc quét nhanh chất lượng câu trả lời.
export function ConfidenceBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-gray-400 text-[10px]">N/A</span>;
  const colorClass =
    score > 0.7
      ? "text-green-700 bg-green-50 border border-green-200"
      : score >= 0.4
        ? "text-yellow-700 bg-yellow-50 border border-yellow-200"
        : "text-red-700 bg-red-50 border border-red-200";
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colorClass}`}>
      {(score * 100).toFixed(0)}%
    </span>
  );
}

// Modal dùng lại để xem passage nguồn và highlight từ khóa query giúp truy vết nhanh.
export function CitationModal({ state, onClose }: { state: CitationModalState; onClose: () => void }) {
  if (!state.open) return null;

  // Tô nổi bật các từ khóa quan trọng trong query để người dùng đối chiếu bằng chứng dễ hơn.
  const highlightContent = (content: string, query: string): ReactNode => {
    const words = query.split(/\s+/).filter((w) => w.length > 2);
    if (!words.length) return content;
    const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const regex = new RegExp(`(${escaped.join("|")})`, "gi");
    const parts = content.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-yellow-200 rounded">{part}</mark> : <span key={i}>{part}</span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <div className="font-semibold text-sm">{state.passage?.filename || "Không rõ nguồn"}</div>
            {state.passage?.pages && state.passage.pages.length > 0 && (
              <div className="text-xs text-gray-500">Trang: {state.passage.pages.join(", ")}</div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none" aria-label="Đóng">
            ✕
          </button>
        </div>
        <div className="p-4 overflow-y-auto text-sm leading-relaxed">
          {state.passage ? (
            highlightContent(state.passage.content, state.query)
          ) : (
            <span className="text-gray-500">Không có nội dung chi tiết cho nguồn này.</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Render preview file local trước khi upload (ảnh hoặc icon tài liệu).
export function renderPreviewAttachment(file: File) {
  if (file.type.startsWith("image/")) {
    return <img src={URL.createObjectURL(file)} alt={file.name} className="smartchatbot-preview-image" />;
  }
  return (
    <div className="smartchatbot-preview-file-wrapper">
      <div className="smartchatbot-preview-file-icon">
        <FileTextOutlined className="smartchatbot-preview-file-icon-svg" />
      </div>
      <div className="smartchatbot-preview-file-name">{file.name}</div>
    </div>
  );
}

// Renderer bubble message dùng chung cho cả chat thường và AI workspace.
export function MessageBubble({ msg, currentUserId }: { msg: Message; currentUserId: string }) {
  const isFromUser = MessageFormatter.isFromUser(msg, currentUserId);

  const isUrl = typeof msg.content === "string" && msg.content.startsWith("http");
  const isImage = isUrl && Utility.isImageUrl(msg.content);
  const isDocument = isUrl && Utility.isDocumentUrl(msg.content);

  // Tách khối "nguồn" khỏi thân câu trả lời để phần citation hiển thị rõ ràng, dễ đọc.
  const { mainContent, sourceLines } = (() => {
    if (isFromUser || !msg.content) return { mainContent: msg.content, sourceLines: [] as string[] };
    const lines = msg.content.split("\n");
    const sourceStart = lines.findIndex((l) => /^[-–]?\s*(Nguồn|Source)\s*:/i.test(l.trim()));
    if (sourceStart === -1) return { mainContent: msg.content, sourceLines: [] as string[] };
    return {
      mainContent: lines.slice(0, sourceStart).join("\n").trim(),
      sourceLines: lines.slice(sourceStart).filter((l) => l.trim()),
    };
  })();

  return (
    <div className={`flex mb-3 ${isFromUser ? "justify-end" : "justify-start"}`}>
      {isImage ? (
        <div className="smartchatbot-bubble-image-wrap">
          <Image width={220} src={msg.content} preview />
        </div>
      ) : (
        <div
          className={`relative group smartchatbot-message-bubble ${
            isFromUser ? "smartchatbot-message-bubble-user" : "smartchatbot-message-bubble-ai"
          }`}
        >
          {isDocument ? (
            <a
              href={msg.content}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline ${isFromUser ? "text-white" : "text-blue-600"}`}
            >
              {Utility.getFilenameFromUrl(msg.content)}
            </a>
          ) : isFromUser ? (
            <div className="text-sm">{msg.content}</div>
          ) : (
            <>
              <div className="text-sm markdown-body">
                <ReactMarkdown>{mainContent}</ReactMarkdown>
              </div>
              {sourceLines.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500 space-y-0.5">
                  {sourceLines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
            </>
          )}

          {msg.created_at && (
            <div
              className={`absolute px-2 py-1 text-[10px] bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none ${
                isFromUser
                  ? "right-full top-1/2 -translate-y-1/2 -mr-[5px]"
                  : "left-full top-1/2 -translate-y-1/2 -ml-[5px]"
              }`}
            >
              {Utility.formatVietnameseDate(msg.created_at)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
