import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Celebrity, CelebrityBatchResponse, CelebrityCategoryId } from "../src/types/celebrity";

const DEFAULT_COUNT = 50;
const MAX_COUNT = 80;
const CATEGORIES_PER_BATCH = 6;
const WIKIPEDIA_CATEGORY_LIMIT = 150;
const WIKIDATA_ENTITY_LIMIT = 50;
const WIKIDATA_SPARQL_ENTITY_LIMIT = 20;
const WIKIPEDIA_ENDPOINT = "https://en.wikipedia.org/w/api.php";
const WIKIDATA_ENDPOINT = "https://www.wikidata.org/w/api.php";
const WIKIDATA_SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "CelebMemoryGame/1.0 (https://github.com/RetroSpectiveMax/CelebMemoryGame)";
const ACTOR_ERA_CATEGORY_IDS = new Set<CelebrityCategoryId>(["classic-actors", "modern-actors"]);

type WikipediaPage = {
  pageid: number;
  title: string;
  fullurl?: string;
  thumbnail?: {
    source: string;
  };
  original?: {
    source: string;
  };
  pageprops?: {
    wikibase_item?: string;
  };
};

type LiveCelebrity = Celebrity & {
  wikidataId?: string;
};

type WikipediaCategoryResponse = {
  query?: {
    pages?: Record<string, WikipediaPage>;
  };
};

type WikidataClaim = {
  mainsnak?: {
    datavalue?: {
      value?: {
        id?: string;
      };
    };
  };
};

type WikidataEntity = {
  id: string;
  labels?: {
    en?: {
      value?: string;
    };
  };
  claims?: {
    P800?: WikidataClaim[];
  };
};

type WikidataEntitiesResponse = {
  entities?: Record<string, WikidataEntity>;
};

type WikidataSparqlBinding = {
  person?: {
    value?: string;
  };
  workLabel?: {
    value?: string;
  };
};

type WikidataSparqlResponse = {
  results?: {
    bindings?: WikidataSparqlBinding[];
  };
};

const categoryIds = [
  "classic-actors",
  "modern-actors",
  "musicians",
  "athletes",
  "comedians",
  "public-figures",
] satisfies CelebrityCategoryId[];
const categoryIdSet = new Set<string>(categoryIds);

const wikipediaCategoriesByCategoryId: Record<CelebrityCategoryId, string[]> = {
  "classic-actors": [
    "Category:20th-century American male actors",
    "Category:20th-century American actresses",
    "Category:20th-century British male actors",
    "Category:20th-century British actresses",
    "Category:Best Actor Academy Award winners",
    "Category:Best Actress Academy Award winners",
  ],
  "modern-actors": [
    "Category:21st-century American male actors",
    "Category:21st-century American actresses",
    "Category:21st-century British male actors",
    "Category:21st-century British actresses",
    "Category:21st-century Canadian male actors",
    "Category:21st-century Canadian actresses",
  ],
  musicians: [
    "Category:Grammy Award winners",
    "Category:MTV Video Music Award winners",
    "Category:Billboard Music Award winners",
    "Category:American pop singers",
    "Category:American rappers",
  ],
  athletes: [
    "Category:Olympic gold medalists for the United States",
    "Category:Association football players",
    "Category:National Basketball Association players",
    "Category:Tennis players",
  ],
  comedians: [
    "Category:American comedians",
    "Category:British comedians",
    "Category:Canadian comedians",
    "Category:Stand-up comedians",
  ],
  "public-figures": [
    "Category:Presidents of the United States",
    "Category:American television personalities",
    "Category:British television personalities",
    "Category:American businesspeople",
  ],
};

const clampCount = (value: string | string[] | undefined) => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number(rawValue ?? DEFAULT_COUNT);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_COUNT;
  }

  return Math.min(Math.max(Math.trunc(parsed), 4), MAX_COUNT);
};

const parseBatch = (value: string | string[] | undefined) => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number(rawValue ?? 0);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.trunc(parsed);
};

const parseCategoryIds = (value: string | string[] | undefined): CelebrityCategoryId[] => {
  const rawValues = (Array.isArray(value) ? value : [value])
    .filter((item): item is string => Boolean(item))
    .flatMap((item) => item.split(","));
  const selectedIds = rawValues.filter((item): item is CelebrityCategoryId => categoryIdSet.has(item));

  return selectedIds.length > 0 ? [...new Set(selectedIds)] : categoryIds;
};

const seededRandom = (seed: number) => {
  let state = seed || 1;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const seededShuffle = <T,>(items: T[], seed: number) => {
  const random = seededRandom(seed);
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
};

const normalizeTitle = (title: string) => title.replace(/\s+\(.+\)$/, "").trim();

const isPlayablePage = (page: WikipediaPage) => {
  const title = page.title.toLowerCase();

  return (
    Boolean(page.thumbnail?.source || page.original?.source) &&
    !title.startsWith("list of") &&
    !title.startsWith("lists of") &&
    !title.includes("award for") &&
    !title.includes("ceremony") &&
    !title.includes("filmography") &&
    !title.includes("discography") &&
    !title.includes("awards and nominations")
  );
};

const chunkItems = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const fetchWikidataEntities = async (
  entityIds: string[],
  props: "claims" | "labels",
): Promise<Record<string, WikidataEntity>> => {
  const uniqueEntityIds = [...new Set(entityIds)].filter(Boolean);

  if (uniqueEntityIds.length === 0) {
    return {};
  }

  const entityChunks = chunkItems(uniqueEntityIds, WIKIDATA_ENTITY_LIMIT);
  const entityResults = await Promise.allSettled(
    entityChunks.map(async (ids) => {
      const params = new URLSearchParams({
        action: "wbgetentities",
        ids: ids.join("|"),
        props,
        languages: "en",
        format: "json",
        origin: "*",
      });

      const response = await fetch(`${WIKIDATA_ENDPOINT}?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          "Api-User-Agent": USER_AGENT,
          "User-Agent": USER_AGENT,
        },
        signal: AbortSignal.timeout(9000),
      });

      if (!response.ok) {
        throw new Error(`Wikidata returned ${response.status}`);
      }

      const data = (await response.json()) as WikidataEntitiesResponse;

      return data.entities ?? {};
    }),
  );

  return entityResults
    .filter((result): result is PromiseFulfilledResult<Record<string, WikidataEntity>> =>
      result.status === "fulfilled",
    )
    .reduce<Record<string, WikidataEntity>>(
      (entitiesById, result) => ({ ...entitiesById, ...result.value }),
      {},
    );
};

const getNotableWorkId = (entity: WikidataEntity | undefined) =>
  entity?.claims?.P800?.find((claim) => claim.mainsnak?.datavalue?.value?.id)?.mainsnak?.datavalue?.value?.id;

const getEntityIdFromWikidataUrl = (value: string | undefined) => value?.split("/").at(-1);

const fetchCastMemberKnownFor = async (entityIds: string[]) => {
  const knownForByEntityId = new Map<string, string>();
  const entityChunks = chunkItems([...new Set(entityIds)].filter(Boolean), WIKIDATA_SPARQL_ENTITY_LIMIT);

  await Promise.allSettled(
    entityChunks.map(async (ids) => {
      const values = ids.map((id) => `wd:${id}`).join(" ");
      const query = `
        SELECT ?person ?workLabel ?sitelinks WHERE {
          VALUES ?person { ${values} }
          ?work wdt:P161 ?person;
                wikibase:sitelinks ?sitelinks;
                wdt:P31/wdt:P279* ?workType.
          VALUES ?workType { wd:Q11424 wd:Q5398426 }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        }
        ORDER BY ?person DESC(?sitelinks)
      `;
      const body = new URLSearchParams({ query });
      const response = await fetch(WIKIDATA_SPARQL_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/sparql-results+json",
          "Api-User-Agent": USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body,
        signal: AbortSignal.timeout(9000),
      });

      if (!response.ok) {
        throw new Error(`Wikidata SPARQL returned ${response.status}`);
      }

      const data = (await response.json()) as WikidataSparqlResponse;

      for (const binding of data.results?.bindings ?? []) {
        const personId = getEntityIdFromWikidataUrl(binding.person?.value);
        const workLabel = binding.workLabel?.value;

        if (personId && workLabel && !knownForByEntityId.has(personId)) {
          knownForByEntityId.set(personId, workLabel);
        }
      }
    }),
  );

  return knownForByEntityId;
};

const enrichKnownFor = async (celebrities: LiveCelebrity[]): Promise<Celebrity[]> => {
  const wikidataIdsByCelebrityId = new Map(
    celebrities
      .filter((celebrity) => celebrity.wikidataId)
      .map((celebrity) => [celebrity.id, celebrity.wikidataId as string]),
  );

  const personEntities = await fetchWikidataEntities([...wikidataIdsByCelebrityId.values()], "claims");
  const notableWorkIdsByCelebrityId = new Map(
    celebrities
      .map((celebrity) => [celebrity.id, getNotableWorkId(personEntities[celebrity.wikidataId ?? ""])])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const workEntities = await fetchWikidataEntities([...notableWorkIdsByCelebrityId.values()], "labels");
  const entityIdsMissingNotableWork = celebrities
    .map((celebrity) => celebrity.wikidataId)
    .filter((wikidataId): wikidataId is string => Boolean(wikidataId))
    .filter((wikidataId) => !personEntities[wikidataId] || !getNotableWorkId(personEntities[wikidataId]));
  const castMemberKnownForByEntityId = await fetchCastMemberKnownFor(entityIdsMissingNotableWork);

  return celebrities.map(({ wikidataId: _wikidataId, ...celebrity }) => {
    const notableWorkId = notableWorkIdsByCelebrityId.get(celebrity.id);
    const notableWorkLabel = notableWorkId ? workEntities[notableWorkId]?.labels?.en?.value : undefined;
    const castMemberWorkLabel = _wikidataId ? castMemberKnownForByEntityId.get(_wikidataId) : undefined;
    const knownFor = notableWorkLabel ?? castMemberWorkLabel;

    return knownFor ? { ...celebrity, knownFor } : celebrity;
  });
};

const getCategoryWindow = (batch: number, selectedCategoryIds: CelebrityCategoryId[]) => {
  const categoryTitles = selectedCategoryIds.flatMap((categoryId) =>
    wikipediaCategoriesByCategoryId[categoryId].map((title) => ({ categoryId, title })),
  );

  if (categoryTitles.length <= CATEGORIES_PER_BATCH) {
    return categoryTitles;
  }

  const selectedCategories = [];

  for (let index = 0; index < CATEGORIES_PER_BATCH; index += 1) {
    selectedCategories.push(categoryTitles[(batch + index) % categoryTitles.length]);
  }

  return selectedCategories;
};

const includesActorEraCategory = (selectedCategoryIds: CelebrityCategoryId[]) =>
  selectedCategoryIds.some((categoryId) => ACTOR_ERA_CATEGORY_IDS.has(categoryId));

const fetchCategoryCelebrities = async (
  categoryId: CelebrityCategoryId,
  categoryTitle: string,
): Promise<LiveCelebrity[]> => {
  const params = new URLSearchParams({
    action: "query",
    generator: "categorymembers",
    gcmtitle: categoryTitle,
    gcmtype: "page",
    gcmlimit: String(WIKIPEDIA_CATEGORY_LIMIT),
    prop: "pageimages|info|pageprops",
    piprop: "original|thumbnail",
    pithumbsize: "900",
    inprop: "url",
    format: "json",
    origin: "*",
  });

  const response = await fetch(`${WIKIPEDIA_ENDPOINT}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "Api-User-Agent": USER_AGENT,
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(9000),
  });

  if (!response.ok) {
    throw new Error(`Wikipedia returned ${response.status}`);
  }

  const data = (await response.json()) as WikipediaCategoryResponse;
  const pages = Object.values(data.query?.pages ?? {});

  return pages.filter(isPlayablePage).map<LiveCelebrity>((page) => {
    const name = normalizeTitle(page.title);
    const imageUrl = page.original?.source ?? page.thumbnail?.source ?? "";
    return {
      id: String(page.pageid),
      name,
      aliases: page.title === name ? [] : [page.title],
      categories: [categoryId],
      imageUrl: imageUrl.replace("http://", "https://"),
      imageCredit: "Wikipedia / Wikimedia Commons",
      sourceUrl: page.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
      wikidataId: page.pageprops?.wikibase_item,
    };
  });
};

const fetchLiveCelebrities = async (
  count: number,
  batch: number,
  selectedCategoryIds: CelebrityCategoryId[],
): Promise<Celebrity[]> => {
  const categoryResults = await Promise.allSettled(
    getCategoryWindow(batch, selectedCategoryIds).map(async ({ categoryId, title }) => ({
      celebrities: await fetchCategoryCelebrities(categoryId, title),
      title,
    })),
  );
  const failedCategoryTitles = categoryResults
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => (result.reason instanceof Error ? result.reason.message : "Unknown category error"));
  const successfulCategoryResults = categoryResults
    .filter(
      (result): result is PromiseFulfilledResult<{ celebrities: LiveCelebrity[]; title: string }> =>
        result.status === "fulfilled",
    )
    .flatMap((result) => result.value.celebrities);

  if (failedCategoryTitles.length > 0) {
    console.warn("Some Wikipedia categories failed to load:", failedCategoryTitles);
  }

  const uniqueCelebrities = new Map<string, LiveCelebrity>();

  for (const celebrity of successfulCategoryResults) {
    const existingCelebrity = uniqueCelebrities.get(celebrity.id);

    uniqueCelebrities.set(
      celebrity.id,
      existingCelebrity
        ? {
            ...existingCelebrity,
            categories: [...new Set([...existingCelebrity.categories, ...celebrity.categories])],
          }
        : celebrity,
    );
  }

  const shuffledCelebrities = seededShuffle([...uniqueCelebrities.values()], batch + 1);
  const shouldRequireKnownFor = includesActorEraCategory(selectedCategoryIds);
  const enrichmentCount = shouldRequireKnownFor ? Math.min(shuffledCelebrities.length, count * 2) : count;
  const enrichedCelebrities = await enrichKnownFor(shuffledCelebrities.slice(0, enrichmentCount));

  if (shouldRequireKnownFor) {
    const celebritiesWithKnownFor = enrichedCelebrities.filter((celebrity) => celebrity.knownFor);

    if (celebritiesWithKnownFor.length >= 4) {
      return celebritiesWithKnownFor.slice(0, count);
    }
  }

  return enrichedCelebrities.slice(0, count);
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const count = clampCount(request.query.count);
  const batch = parseBatch(request.query.batch);
  const selectedCategoryIds = parseCategoryIds(request.query.categories);

  try {
    const celebrities = await fetchLiveCelebrities(count, batch, selectedCategoryIds);

    if (celebrities.length < 4) {
      throw new Error("Wikipedia returned too few playable celebrities");
    }

    response.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    response.status(200).json({
      celebrities,
      source: "live",
    } satisfies CelebrityBatchResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown API error";

    response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    response.status(502).json({
      error: "Could not load live celebrities",
      message,
    });
  }
}
