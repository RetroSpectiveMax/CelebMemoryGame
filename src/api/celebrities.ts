import { celebrities as fallbackCelebrities } from "../data/celebrities";
import type { Celebrity, CelebrityBatchResponse, CelebrityCategoryId } from "../types/celebrity";

const DEFAULT_BATCH_SIZE = 50;

const filterByCategories = (
  celebrities: Celebrity[],
  selectedCategoryIds: CelebrityCategoryId[],
) => {
  if (selectedCategoryIds.length === 0) {
    return celebrities;
  }

  const selectedCategories = new Set(selectedCategoryIds);

  return celebrities.filter((celebrity) =>
    celebrity.categories.some((categoryId) => selectedCategories.has(categoryId)),
  );
};

export const fetchCelebrityBatch = async (
  batch: number,
  count = DEFAULT_BATCH_SIZE,
  selectedCategoryIds: CelebrityCategoryId[] = [],
): Promise<CelebrityBatchResponse> => {
  const params = new URLSearchParams({
    count: String(count),
    batch: String(batch),
  });

  if (selectedCategoryIds.length > 0) {
    params.set("categories", selectedCategoryIds.join(","));
  }

  try {
    const response = await fetch(`/api/celebrities?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Celebrity API returned ${response.status}`);
    }

    return (await response.json()) as CelebrityBatchResponse;
  } catch {
    return {
      celebrities: filterByCategories(fallbackCelebrities, selectedCategoryIds),
      source: "fallback",
    };
  }
};
