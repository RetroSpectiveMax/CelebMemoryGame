import { celebrities as fallbackCelebrities } from "../data/celebrities";
import type { Celebrity, CelebrityBatchResponse, CelebrityCategoryId } from "../types/celebrity";

const DEFAULT_BATCH_SIZE = 50;
const actorEraCategoryIds = new Set<CelebrityCategoryId>(["classic-actors", "modern-actors"]);

type CelebrityApiErrorResponse = {
  error?: string;
  message?: string;
};

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

const isActorEraOnlySelection = (selectedCategoryIds: CelebrityCategoryId[]) =>
  selectedCategoryIds.length > 0 &&
  selectedCategoryIds.every((categoryId) => actorEraCategoryIds.has(categoryId));

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

  if (isActorEraOnlySelection(selectedCategoryIds)) {
    const celebrities = filterByCategories(fallbackCelebrities, selectedCategoryIds);

    return {
      celebrities,
      source: "fallback",
    };
  }

  try {
    const response = await fetch(`/api/celebrities?${params.toString()}`);

    if (!response.ok) {
      let apiError: CelebrityApiErrorResponse = {};

      try {
        apiError = (await response.json()) as CelebrityApiErrorResponse;
      } catch {
        apiError = {};
      }

      throw new Error(
        apiError.message ?? apiError.error ?? `Celebrity API returned ${response.status}`,
      );
    }

    return (await response.json()) as CelebrityBatchResponse;
  } catch (error) {
    console.warn(
      "Using fallback celebrities because the live celebrity API failed.",
      error instanceof Error ? error.message : error,
    );

    const celebrities = filterByCategories(fallbackCelebrities, selectedCategoryIds);

    return {
      celebrities,
      source: "fallback",
    };
  }
};
