import { PUBLIC_API_BASE_URL } from "@/shared/constants/constant";
import { logger } from "@/shared/utils/logger";

export class ChatService {
  CHAT_URL = {
    STREAM: `${PUBLIC_API_BASE_URL}/langchain/adv/retrieve_document`,
    CLEAR_HISTORY: (sessionId: string) => `${PUBLIC_API_BASE_URL}/conversations_history/${sessionId}`,
    CONVERSATION_KEY: (userId: string) => `${PUBLIC_API_BASE_URL}/chatroom/conversation_key/${userId}`, // Not implemented in backend
    MESSAGES: (conversation_key: string) => `${PUBLIC_API_BASE_URL}/chatroom/messages/${conversation_key}`, // Not implemented in backend
  }

  async *streamChat(prompt: string, sessionId: string) {
    const res = await fetch(this.CHAT_URL.STREAM, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: prompt,
        session_id: sessionId || 'anonymous',
      }),
    });

    if (!res.ok) {
      throw new Error('Failed to start chat stream');
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        yield chunk;
      }
    } finally {
      reader.releaseLock();
    }
  }

  async fetchConversationKey(user_id: string) {
    if (!user_id) return [];

    const url = this.CHAT_URL.CONVERSATION_KEY(user_id)
    logger.api('GET', url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Lõi khi tài diliu conversation");
    }

    let result = await response.json();

    return result;
  }

  async fetchMessages(conversation_key: string) {
    if (!conversation_key || conversation_key === "None") return [];

    const url = this.CHAT_URL.MESSAGES(conversation_key)

    const response = await fetch(url);
    logger.api('GET', url);


    if (!response.ok) {
      throw new Error("Lõi khi tài diliu messages");
    }

    let data = await response.json();

    logger.success('[fetchMessages] data:', data);
    return data
  }

  async sendChatMessage(sessionId: string, message: string) {
    const url = this.CHAT_URL.STREAM;
    logger.api('POST', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: message,
        session_id: sessionId || 'anonymous',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status}`);
    }

    return response;
  }

  async clearHistory(sessionId: string) {
    const url = this.CHAT_URL.CLEAR_HISTORY(sessionId);
    logger.api('DELETE', url);

    const response = await fetch(url, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to clear history: ${response.status}`);
    }

    return response.json();
  }
}
