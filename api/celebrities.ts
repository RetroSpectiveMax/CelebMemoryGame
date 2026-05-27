import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Celebrity, CelebrityBatchResponse } from "../src/types/celebrity";

const DEFAULT_COUNT = 50;
const MAX_COUNT = 80;
const CATEGORIES_PER_BATCH = 6;
const WIKIPEDIA_CATEGORY_LIMIT = 150;
const WIKIPEDIA_ENDPOINT = "https://en.wikipedia.org/w/api.php";
const USER_AGENT = "CelebMemoryGame/1.0 (https://github.com/RetroSpectiveMax/CelebMemoryGame)";

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
};

type WikipediaCategoryResponse = {
  query?: {
    pages?: Record<string, WikipediaPage>;
  };
};

const categoryTitles = [
  "Category:Best Actor Academy Award winners",
  "Category:Best Actress Academy Award winners",
  "Category:Grammy Award winners",
  "Category:Primetime Emmy Award winners",
  "Category:Golden Globe Award-winning actors",
  "Category:MTV Video Music Award winners",
  "Category:Billboard Music Award winners",
  "Category:American film actors",
  "Category:American television actors",
  "Category:American pop singers",
  "Category:American rappers",
  "Category:American comedians",
  "Category:British film actors",
  "Category:British television actors",
  "Category:Canadian film actors",
  "Category:Grammy Award winners",
  "Category:Academy Award winners",
  "Category:Olympic gold medalists for the United States",
  "Category:Association football players",
];

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

const getCategoryWindow = (batch: number) => {
  const selectedCategories = [];

  for (let index = 0; index < CATEGORIES_PER_BATCH; index += 1) {
    selectedCategories.push(categoryTitles[(batch + index) % categoryTitles.length]);
  }

  return selectedCategories;
};

const fetchCategoryCelebrities = async (categoryTitle: string): Promise<Celebrity[]> => {
  const params = new URLSearchParams({
    action: "query",
    generator: "categorymembers",
    gcmtitle: categoryTitle,
    gcmtype: "page",
    gcmlimit: String(WIKIPEDIA_CATEGORY_LIMIT),
    prop: "pageimages|info",
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

  return pages.filter(isPlayablePage).map<Celebrity>((page) => {
    const name = normalizeTitle(page.title);
    const imageUrl = page.original?.source ?? page.thumbnail?.source ?? "";
    return {
      id: String(page.pageid),
      name,
      aliases: page.title === name ? [] : [page.title],
      imageUrl: imageUrl.replace("http://", "https://"),
      imageCredit: "Wikipedia / Wikimedia Commons",
      sourceUrl: page.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
    };
  });
};

const fetchLiveCelebrities = async (count: number, batch: number): Promise<Celebrity[]> => {
  const categoryResults = await Promise.all(getCategoryWindow(batch).map(fetchCategoryCelebrities));
  const uniqueCelebrities = new Map<string, Celebrity>();

  for (const celebrity of categoryResults.flat()) {
    uniqueCelebrities.set(celebrity.id, celebrity);
  }

  return seededShuffle([...uniqueCelebrities.values()], batch + 1).slice(0, count);
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const count = clampCount(request.query.count);
  const batch = parseBatch(request.query.batch);

  try {
    const celebrities = await fetchLiveCelebrities(count, batch);

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
