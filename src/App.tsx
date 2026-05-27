import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchCelebrityBatch } from "./api/celebrities";
import type { Celebrity } from "./types/celebrity";
import { isCorrectGuess } from "./utils/guess";

const MAX_TEXT_ATTEMPTS = 3;
const CHOICE_COUNT = 4;
const RANDOM_BATCH_RANGE = 1000;
const BATCH_LOAD_RETRY_LIMIT = 5;
const RECENT_SEEN_STORAGE_KEY = "celebrity-memory-game:recent-seen";
const RECENT_SEEN_LIMIT = 50;

type GamePhase = "typing" | "multiple-choice" | "answered";

type Feedback = {
  tone: "correct" | "incorrect" | "hint";
  message: string;
};

const shuffle = <T,>(items: T[]) => {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
};

const buildChoices = (answer: Celebrity, pool: Celebrity[]) => {
  const distractors = shuffle(pool.filter((celebrity) => celebrity.id !== answer.id)).slice(
    0,
    CHOICE_COUNT - 1,
  );

  return shuffle([answer, ...distractors]);
};

const getRandomBatch = () => Math.floor(Math.random() * RANDOM_BATCH_RANGE);

const readRecentSeenIds = () => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_SEEN_STORAGE_KEY) ?? "[]");

    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
};

const rememberSeenCelebrity = (celebrityId: string) => {
  if (typeof window === "undefined") {
    return;
  }

  const recentSeenIds = readRecentSeenIds().filter((id) => id !== celebrityId);
  recentSeenIds.push(celebrityId);

  window.localStorage.setItem(
    RECENT_SEEN_STORAGE_KEY,
    JSON.stringify(recentSeenIds.slice(-RECENT_SEEN_LIMIT)),
  );
};

const filterRecentlySeenCelebrities = (celebrities: Celebrity[]) => {
  const recentSeenIds = new Set(readRecentSeenIds());

  return celebrities.filter((celebrity) => !recentSeenIds.has(celebrity.id));
};

function App() {
  const [deck, setDeck] = useState<Celebrity[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [batch, setBatch] = useState(0);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<GamePhase>("typing");
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [isLoadingBatch, setIsLoadingBatch] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"live" | "fallback">("live");
  const [feedback, setFeedback] = useState<Feedback>({
    tone: "hint",
    message: "Type the celebrity's name to start.",
  });
  const [choices, setChoices] = useState<Celebrity[]>([]);
  const [imageFailed, setImageFailed] = useState(false);
  const hasLoadedInitialBatch = useRef(false);

  const currentCelebrity = deck[currentIndex];
  const progressLabel = currentCelebrity ? `${currentIndex + 1} / ${deck.length}` : "0 / 0";
  const attemptsLeft = MAX_TEXT_ATTEMPTS - attempts;

  const choiceNames = useMemo(() => choices.map((choice) => choice.name), [choices]);

  const resetRound = useCallback(() => {
    setPhase("typing");
    setGuess("");
    setAttempts(0);
    setChoices([]);
    setImageFailed(false);
    setFeedback({
      tone: "hint",
      message: "New celebrity. Enter your best guess.",
    });
  }, []);

  const loadBatch = useCallback(
    async (nextBatch: number) => {
      setIsLoadingBatch(true);
      setLoadError(null);

      try {
        for (let attempt = 0; attempt <= BATCH_LOAD_RETRY_LIMIT; attempt += 1) {
          const batchToLoad = nextBatch + attempt;
          const result = await fetchCelebrityBatch(batchToLoad);

          if (result.celebrities.length < CHOICE_COUNT) {
            throw new Error("Not enough celebrities were returned to build choices.");
          }

          const freshCelebrities = filterRecentlySeenCelebrities(result.celebrities);
          const canUseFreshBatch = freshCelebrities.length >= CHOICE_COUNT;
          const isLastAttempt = attempt === BATCH_LOAD_RETRY_LIMIT;
          const celebrities = canUseFreshBatch ? freshCelebrities : result.celebrities;

          if (canUseFreshBatch || result.source === "fallback" || isLastAttempt) {
            setDeck(shuffle(celebrities));
            setCurrentIndex(0);
            setBatch(batchToLoad);
            setDataSource(result.source);
            resetRound();
            setFeedback({
              tone: "hint",
              message:
                result.source === "fallback"
                  ? "Live celebrities are unavailable, so this round is using the backup list."
                  : "Loaded a fresh live batch. Enter your best guess.",
            });
            return;
          }
        }
      } catch {
        setDeck([]);
        setCurrentIndex(0);
        setLoadError("Could not load celebrities. Please try again.");
      } finally {
        setIsLoadingBatch(false);
      }
    },
    [resetRound],
  );

  useEffect(() => {
    if (hasLoadedInitialBatch.current) {
      return;
    }

    hasLoadedInitialBatch.current = true;
    void loadBatch(getRandomBatch());
  }, [loadBatch]);

  useEffect(() => {
    if (!currentCelebrity) {
      return;
    }

    rememberSeenCelebrity(currentCelebrity.id);
  }, [currentCelebrity]);

  const startMultipleChoice = () => {
    if (!currentCelebrity) {
      return;
    }

    setPhase("multiple-choice");
    setChoices(buildChoices(currentCelebrity, deck));
    setFeedback({
      tone: "hint",
      message: "No worries. Pick the correct name from these choices.",
    });
  };

  const handleGuessSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentCelebrity || !guess.trim() || phase !== "typing") {
      return;
    }

    if (isCorrectGuess(guess, currentCelebrity)) {
      setScore((currentScore) => currentScore + 1);
      setPhase("answered");
      setFeedback({
        tone: "correct",
        message: `Correct! It is ${currentCelebrity.name}.`,
      });
      return;
    }

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    if (nextAttempts >= MAX_TEXT_ATTEMPTS) {
      startMultipleChoice();
      return;
    }

    setFeedback({
      tone: "incorrect",
      message: `Not quite. Try again. ${MAX_TEXT_ATTEMPTS - nextAttempts} ${
        MAX_TEXT_ATTEMPTS - nextAttempts === 1 ? "try" : "tries"
      } left before multiple choice.`,
    });
  };

  const handleSkipToMultipleChoice = () => {
    if (phase !== "typing") {
      return;
    }

    setAttempts(MAX_TEXT_ATTEMPTS);
    startMultipleChoice();
  };

  const handleChoiceSelect = (choice: Celebrity) => {
    if (!currentCelebrity || phase !== "multiple-choice") {
      return;
    }

    const isCorrect = choice.id === currentCelebrity.id;

    if (isCorrect) {
      setScore((currentScore) => currentScore + 1);
    }

    setPhase("answered");
    setFeedback({
      tone: isCorrect ? "correct" : "incorrect",
      message: isCorrect
        ? `Correct! It is ${currentCelebrity.name}.`
        : `Good try. The correct answer was ${currentCelebrity.name}.`,
    });
  };

  const handleNext = () => {
    if (currentIndex >= deck.length - 1) {
      void loadBatch(batch + 1);
      return;
    }

    setCurrentIndex((index) => index + 1);
    resetRound();
  };

  if (isLoadingBatch || !currentCelebrity) {
    return (
      <main className="app-shell">
        <section className="game-card game-card--complete" aria-labelledby="loading-title">
          <p className="eyebrow">Celebrity Memory Game</p>
          <h1 id="loading-title">{loadError ? "Could not load celebrities" : "Loading celebrities..."}</h1>
          <p className="summary">
            {loadError ??
              "Fetching a fresh batch of free Wikimedia celebrity photos for the next round."}
          </p>
          {loadError && (
            <button className="primary-button" type="button" onClick={() => void loadBatch(batch)}>
              Try again
            </button>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="game-card" aria-labelledby="game-title">
        <header className="game-header">
          <div>
            <p className="eyebrow">Celebrity Memory Game</p>
            <h1 id="game-title">Who is this celebrity?</h1>
          </div>
          <div className="scoreboard" aria-label="Game progress and score">
            <span>{progressLabel}</span>
            <strong>{score} pts</strong>
            <small>{dataSource === "live" ? "Live batch" : "Backup list"}</small>
          </div>
        </header>

        <div
          className="photo-panel"
          style={{ "--photo-url": `url("${currentCelebrity.imageUrl}")` } as CSSProperties}
        >
          {imageFailed ? (
            <div className="photo-fallback">
              Image unavailable. Use the photo source link below to check the file.
            </div>
          ) : (
            <img
              className="celebrity-photo"
              src={currentCelebrity.imageUrl}
              alt="Celebrity to guess"
              onError={() => setImageFailed(true)}
            />
          )}
          <a
            className="photo-credit"
            href={currentCelebrity.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Photo: {currentCelebrity.imageCredit}
          </a>
        </div>

        <div className={`feedback feedback--${feedback.tone}`} role="status">
          {feedback.message}
        </div>

        {phase === "typing" && (
          <form className="guess-form" onSubmit={handleGuessSubmit}>
            <label htmlFor="guess">Enter the celebrity name</label>
            <div className="guess-row">
              <input
                id="guess"
                type="text"
                value={guess}
                onChange={(event) => setGuess(event.target.value)}
                placeholder="Example: Taylor Swift"
                autoComplete="off"
              />
              <button className="primary-button" type="submit">
                Guess
              </button>
              <button className="secondary-button" type="button" onClick={handleSkipToMultipleChoice}>
                Skip to multiple choice
              </button>
            </div>
            <p className="attempts">
              {attemptsLeft} {attemptsLeft === 1 ? "try" : "tries"} before multiple choice.
            </p>
          </form>
        )}

        {phase === "multiple-choice" && (
          <div className="choice-panel" aria-label="Multiple choice answers">
            {choices.map((choice) => (
              <button
                className="choice-button"
                key={choice.id}
                type="button"
                onClick={() => handleChoiceSelect(choice)}
              >
                {choice.name}
              </button>
            ))}
            <p className="sr-only">Choices: {choiceNames.join(", ")}</p>
          </div>
        )}

        {phase === "answered" && (
          <button className="primary-button next-button" type="button" onClick={handleNext}>
            {currentIndex === deck.length - 1 ? "Load more celebrities" : "Next celebrity"}
          </button>
        )}
      </section>
    </main>
  );
}

export default App;
