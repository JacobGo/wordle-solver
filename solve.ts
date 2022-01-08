import { Game, Slot } from "./game.ts";
import { FrequencyDistribution } from "./frequency_distribution.ts";
import { chooseRandom } from "./utils.ts";
import { parse } from "https://deno.land/std@0.120.0/flags/mod.ts";

// Silence debug output.
console.debug = () => {};

const { tries, trials } = parse(Deno.args);
const MAX_TRIES = tries || 6;
const TRIALS = trials || 100000;

type Guess = {
  word: string;
  confidence: string;
};

class Solver {
  /** Letter frequency distribution of the dictionary */
  private lettersFreqDist: FrequencyDistribution;
  private pool: string[];

  private known = ["", "", "", "", ""];
  private always = new Set<string>();
  private never = new Set<string>();

  private game: Game;
  private tries = 0;

  constructor(
    dictionary: string[],
    lettersFreqDist: FrequencyDistribution,
    game: Game
  ) {
    this.pool = [...dictionary];
    this.lettersFreqDist = lettersFreqDist;
    this.game = game;
  }

  findGuess(): Guess {
    console.debug(`**** GUESS ${this.tries + 1} ****`);
    console.debug({
      poolSize: this.pool.length
    });
    if (this.pool.length === 0) {
      throw new Error("Exhausted pool, solution unfindable.");
    }
    return {
      word: chooseRandom(this.pool),
      confidence: ((1 / this.pool.length) * 100).toPrecision(4)
    };
  }

  filterPool(slots: Slot[], guess: Guess): void {
    // Update the known facts with the slot information.
    for (const [i, slot] of slots.entries()) {
      const letter = guess.word[i];
      switch (slot) {
        case Slot.RIGHT_SPOT:
          this.always.add(letter);
          this.known[i] = letter;
          break;
        case Slot.WRONG_SPOT:
          this.always.add(letter);
          break;
        case Slot.MISSING:
          this.never.add(letter);
          break;
      }
    }
    console.debug({
      known: this.known,
      always: this.always,
      never: this.never
    });

    const knownCount = this.known.filter((l) => l != "").length;
    this.pool = this.pool.filter((word) => {
      let rightMatches = 0;
      let knownMatches = 0;

      for (let i = 0; i < word.length; i++) {
        const letter = word[i];

        if (this.never.has(letter)) {
          return false;
        }

        if (this.always.has(letter)) {
          rightMatches += 1;
        }

        if (this.known[i] != "") {
          if (letter == this.known[i]) {
            knownMatches += 1;
          } else {
            return false;
          }
        }
      }
      // >= accounts for repeated letters
      return rightMatches >= this.always.size && knownMatches == knownCount;
    });
  }

  play(): number {
    while (this.tries < MAX_TRIES) {
      this.tries += 1;
      const guess = this.findGuess();
      console.debug(`${guess.word} (${guess.confidence})?`);
      const { isCorrect, slots } = this.game.guess(guess.word);
      if (isCorrect) {
        console.debug(`Found solution after ${this.tries} guesses!`);
        return this.tries;
      }
      this.filterPool(slots, guess);
    }
    console.debug(`Failed to find solution after ${this.tries} tries.`);
    return 0;
  }
}

const dictionary = JSON.parse(
  await Deno.readTextFile("dictionary.json")
) as string[];

const simulate = async (rounds = 100) => {
  const tries = new Map<number, number>();
  const freqDist = new FrequencyDistribution(dictionary);

  for (let i = 0; i < rounds; i++) {
    if (i % 1000 === 0) {
      console.log(`${(i / rounds) * 100}%`);
    }
    const solution = chooseRandom(dictionary);
    console.debug(`New game with ${solution}`);
    const game = new Game(solution);
    const solver = new Solver(dictionary, freqDist, game);
    const attempt = solver.play();
    // @ts-ignore doesn't understand
    tries.set(attempt, tries.get(attempt) ? tries.get(attempt) + 1 : 1);
  }

  let values = "";
  for (let i = 0; i < MAX_TRIES; i++) {
    values += `${tries.get(i) || 0},`;
  }
  values += tries.get(MAX_TRIES) || 0;

  await Deno.writeTextFile(
    "output.csv",
    `${Array.from(Array(MAX_TRIES + 1).keys()).join(",")}\n${values}`
  );
};

simulate(TRIALS);
