import { PUBLIC_API_BASE_URL } from "@/shared/constants/constant";
import { logger } from "@/shared/utils/logger";
import type { AIChatHistoryResponse } from "../types";

export class AIService {
  AI_URL = {
    UPLOAD_PAC: `${PUBLIC_API_BASE_URL}/langchain/adv/load_document`,
    CLEAR_VECTOR_STORE: `${PUBLIC_API_BASE_URL}/langchain/adv/clear_vector_store`,
    AI_HISTORY: (sessionId: string) => `${PUBLIC_API_BASE_URL}/conversations_history/${sessionId}`,
  }

  async fetchAIChatHistory(sessionId: string, role?: string): Promise<AIChatHistoryResponse> {
    const url = new URL(this.AI_URL.AI_HISTORY(sessionId));
    if (role) {
      url.searchParams.append('role', role);
    }
    logger.api('GET', url.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch AI chat history: ${response.status}`);
    }
    logger.info('[fetchAIChatHistory] status:', response.status);

    const data = await response.json();

    logger.success('[fetchAIChatHistory] data:', data);
    return data;
  }

  async fetchPACRAGHistory(sessionId: string): Promise<AIChatHistoryResponse> {
    return this.fetchAIChatHistory(sessionId, 'adv-user,adv-assistant');
  }

  async fetchGraphRAGHistory(sessionId: string): Promise<AIChatHistoryResponse> {
    return this.fetchAIChatHistory(sessionId, 'graph-user,graph-assistant');
  }

  async uploadFile(file: File, sessionId: string) {
    const formData = new FormData();
    formData.append('files', file);

    const response = await fetch(this.AI_URL.UPLOAD_PAC, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.status}`);
    }

    return response.json();
  }

  async clearVectorStore() {
    const url = this.AI_URL.CLEAR_VECTOR_STORE;
    logger.api('DELETE', url);

    const response = await fetch(url, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to clear vector store: ${response.status}`);
    }

    return response.json();
  }
}
