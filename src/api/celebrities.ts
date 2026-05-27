import { celebrities as fallbackCelebrities } from "../data/celebrities";
import type { CelebrityBatchResponse } from "../types/celebrity";

const DEFAULT_BATCH_SIZE = 24;

export const fetchCelebrityBatch = async (
  batch: number,
  count = DEFAULT_BATCH_SIZE,
): Promise<CelebrityBatchResponse> => {
  try {
    const response = await fetch(`/api/celebrities?count=${count}&batch=${batch}`);

    if (!response.ok) {
      throw new Error(`Celebrity API returned ${response.status}`);
    }

    return (await response.json()) as CelebrityBatchResponse;
  } catch {
    return {
      celebrities: fallbackCelebrities,
      source: "fallback",
    };
  }
};
