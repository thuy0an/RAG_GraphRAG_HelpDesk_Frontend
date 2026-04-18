import React from "react";
import { Button } from "antd";

interface FileUploadPanelProps {
  files: File[];
  isUploading: boolean;
  showChunkConfig: boolean;
  isClearingHistory: boolean;
  isClearingVector: boolean;
  onChooseFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadDocs: () => void;
  onToggleChunkConfig: () => void;
  onClearHistory: () => void;
  onClearVectorStore: () => void;
}

export function FileUploadPanel({
  files,
  isUploading,
  showChunkConfig,
  isClearingHistory,
  isClearingVector,
  onChooseFiles,
  onUploadDocs,
  onToggleChunkConfig,
  onClearHistory,
  onClearVectorStore
}: FileUploadPanelProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="file"
        accept=".pdf,.doc,.docx"
        multiple
        onChange={onChooseFiles}
        style={{ display: "none" }}
        id="aiUploadInput"
      />
      <Button
        size="small"
        onClick={() => document.getElementById("aiUploadInput")?.click()}
      >
        Chọn file
      </Button>
      <Button
        size="small"
        type="primary"
        onClick={onUploadDocs}
        disabled={files.length === 0 || isUploading}
      >
        {isUploading ? "Đang upload..." : "Upload tài liệu"}
      </Button>
      <Button
        size="small"
        onClick={onToggleChunkConfig}
      >
        {showChunkConfig ? "Đn cấu hình chunk" : "Cấu hình chunk"}
      </Button>
      <Button
        size="small"
        danger
        onClick={onClearHistory}
        disabled={isClearingHistory}
      >
        Xóa lịch sử
      </Button>
      <Button
        size="small"
        danger
        onClick={onClearVectorStore}
        disabled={isClearingVector}
      >
        Xóa vector store
      </Button>
    </div>
  );
}
