export type Celebrity = {
  id: string;
  name: string;
  aliases: string[];
  imageUrl: string;
  imageCredit: string;
  sourceUrl: string;
};

export type CelebrityBatchResponse = {
  celebrities: Celebrity[];
  source: "live" | "fallback";
};
