import type { Celebrity } from "../types/celebrity";

export const normalizeGuess = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const isCorrectGuess = (guess: string, celebrity: Celebrity) => {
  const normalizedGuess = normalizeGuess(guess);
  const acceptedAnswers = [celebrity.name, ...celebrity.aliases].map(normalizeGuess);

  return acceptedAnswers.includes(normalizedGuess);
};
