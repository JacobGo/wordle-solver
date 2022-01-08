import { Game, Slot } from "./game.ts";
import { FrequencyDistribution } from "./frequency_distribution.ts";
import { chooseRandom } from "./utils.ts";
import { parse } from "https://deno.land/std@0.120.0/flags/mod.ts";

// Silence debug output.
console.debug = () => {};

const { tries, trials, start, saveOutput } = parse(Deno.args);
const MAX_TRIES = tries || 6;
const TRIALS = trials || 100000;
const START_WORD = start || "weary";
const SAVE_OUTPUT = saveOutput || false;

type Guess = {
  word: string;
  confidence: string;
};

class Solver {
  /** Letter frequency distribution of the dictionary */
  private lettersFreqDist: FrequencyDistribution;
  private pool: string[];

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
    console.debug(`**** GUESS ${this.tries} ****`);
    console.debug({
      poolSize: this.pool.length
    });
    if (this.pool.length === 0) {
      throw new Error("Exhausted pool, solution unfindable.");
    }
    return {
      word: this.tries === 1 ? START_WORD : chooseRandom(this.pool),
      confidence: `${((1 / this.pool.length) * 100).toPrecision(4)}%`
    };
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

      for (const [i, slot] of slots.entries()) {
        const letter = guess.word[i];
        if (slot === Slot.RIGHT_SPOT) {
          this.pool = this.pool.filter((word) => word[i] === letter);
        } else if (slot === Slot.WRONG_SPOT) {
          this.pool = this.pool.filter(
            (word) => word.includes(letter) && word[i] !== letter
          );
        } else {
          this.pool = this.pool.filter((word) => !word.includes(letter));
        }
      }
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

  const output = `${Array.from(Array(MAX_TRIES + 1).keys()).join(
    ","
  )}\n${values}`;

  if (SAVE_OUTPUT) {
    await Deno.writeTextFile("output.csv", output);
  } else {
    console.log(output);
  }

  let weights = 0;
  for (const [t, count] of tries.entries()) {
    weights += t * count;
  }
  console.log(`Average guesses: ${weights / TRIALS}`);
};

simulate(TRIALS);
