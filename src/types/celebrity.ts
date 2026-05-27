export const celebrityCategories = [
  {
    id: "classic-actors",
    label: "Classic actors",
    description: "Legacy movie and TV stars from earlier Hollywood eras.",
  },
  {
    id: "modern-actors",
    label: "Modern actors",
    description: "Contemporary movie and TV stars from recent decades.",
  },
  {
    id: "musicians",
    label: "Musicians",
    description: "Singers, rappers, bands, and award-winning artists.",
  },
  {
    id: "athletes",
    label: "Athletes",
    description: "Olympians, footballers, and other sports icons.",
  },
  {
    id: "comedians",
    label: "Comedians",
    description: "Stand-up performers, sketch stars, and comic actors.",
  },
  {
    id: "public-figures",
    label: "Public figures",
    description: "Leaders, media personalities, and widely known names.",
  },
] as const;

export type CelebrityCategory = (typeof celebrityCategories)[number];
export type CelebrityCategoryId = CelebrityCategory["id"];

export type Celebrity = {
  id: string;
  name: string;
  aliases: string[];
  categories: CelebrityCategoryId[];
  knownFor?: string;
  imageUrl: string;
  imageCredit: string;
  sourceUrl: string;
};

export type CelebrityBatchResponse = {
  celebrities: Celebrity[];
  source: "live" | "fallback";
};
