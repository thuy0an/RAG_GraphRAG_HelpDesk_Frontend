import { PUBLIC_WS_BASE_URL } from "@/shared/constants/constant";

export class WebSocketService {
  WS_URL = {
    CHAT: {
      USER_ROOM: (userId: string) => `${PUBLIC_WS_BASE_URL}/ws/${userId}`,
      CONVERSATION_ROOM: (userId: string, conversationKey: string) =>
        `${PUBLIC_WS_BASE_URL}/ws/${userId}/${conversationKey}`,
    }
  }

  getUserRoomUrl(userId: string) {
    return this.WS_URL.CHAT.USER_ROOM(userId);
  }

  getConversationRoomUrl(userId: string, conversationKey: string) {
    return this.WS_URL.CHAT.CONVERSATION_ROOM(userId, conversationKey);
  }
}
