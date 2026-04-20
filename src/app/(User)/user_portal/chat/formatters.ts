// Hàm tiện ích chuyển đổi payload lịch sử chat từ backend sang kiểu Message dùng trong UI.
// Tách lớp này giúp logic mapping có thể test độc lập, không dính React component.

import type { Message } from "./types";

export class MessageFormatter {
  // Chuẩn hóa danh sách record lịch sử từ backend thành cấu trúc message thống nhất cho frontend.
  static formatAIHistoryMessages(response: any): Message[] {
    const items: any[] = response?.data || [];
    return items.map((item: any) => ({
      id: `${item.id}`,
      turn_id: item.turn_id,
      sender_id:
        item.role === "user"
          ? "user"
          : item.role === "assistant_rag"
            ? "ai-rag"
            : item.role === "assistant_graphrag"
              ? "ai-graphrag"
              : "ai-assistant",
      content: item.content,
      timestamp: item.timestamp,
      created_at: item.timestamp,
      role: item.role === "user" ? "user" : "ai",
    }));
  }

  // Xác định message có phải của người dùng hiện tại hay không để render bubble đúng phía.
  static isFromUser(message: any, currentUserId: string): boolean {
    const senderId = message.sender_id;
    return senderId === currentUserId || message.role === "user";
  }
}
