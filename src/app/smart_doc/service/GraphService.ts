import { PUBLIC_API_BASE_URL } from "@/shared/constants/constant";
import { logger } from "@/shared/utils/logger";

export class GraphService {
  async graphQuery(query: string, sessionId: string) {
    const url = `${PUBLIC_API_BASE_URL}/langchain/graph/query`;
    logger.api('POST', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        session_id: sessionId || 'anonymous',
        source: null,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to execute graph query: ${response.status}`);
    }

    return response.json();
  }
}
