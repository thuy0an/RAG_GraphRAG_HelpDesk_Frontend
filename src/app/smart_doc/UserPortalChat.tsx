import type { Message, TypingState, WebSocketHookReturn, ChatModeToggleProps, ChatState } from "./types";

// Re-exports from new component files
export { Utility } from "./utils/ChatUtils";
export { ChunkConfigPanel } from "./components/ChunkConfigPanel";
export { CompareMetricsPanel } from "./components/CompareMetricsPanel";
export { FileUploadPanel } from "./components/FileUploadPanel";
export { FilePreview } from "./components/FilePreview";
export { AIChatComponent } from "./components/AIChatComponent";
export { AIChatWorkspace } from "./components/AIChatWorkspace";

// Type exports
export type {
  ChatState,
  Message,
  TypingState,
  WebSocketHookReturn,
  ChatModeToggleProps
}