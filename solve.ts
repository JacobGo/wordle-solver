import { Game, Slot } from "./game.ts";
import { FrequencyDistribution } from "./frequency_distribution.ts";

// Silence debug output.
console.debug = () => {};

const MAX_TRIES = 6;

type Guess = {
  word: string;
  confidence: number;
};

class Solver {
  /** Letter frequency distribution of the dictionary */
  private lettersFreqDist: FrequencyDistribution;
  private pool: string[];

  private slots = ["", "", "", "", ""];

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
      slots: this.slots,
      poolSize: this.pool.length
    });
    return {
      word: choose(this.pool),
      confidence: 0
    };
  }

  play(): number {
    while (this.tries < 6) {
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
          this.slots[i] = letter;
          this.pool = this.pool.filter((word) => word[i] === letter);
        } else if (slot === Slot.WRONG_SPOT) {
          this.pool = this.pool.filter((word) => word.includes(letter));
        } else {
          this.pool = this.pool.filter((word) => !word.includes(letter));
        }
      }
    }
    console.debug(`Failed to find solution after ${this.tries} tries.`);
    return 0;
  }
}

function choose<T>(arr: Array<T>): T {
  return arr[Math.floor(Math.random() * arr.length)];
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
    const solution = choose(dictionary);
    console.debug(`New game with ${solution}`);
    const game = new Game(solution);
    const solver = new Solver(dictionary, freqDist, game);
    const attempt = solver.play();
    // @ts-ignore doesn't understand
    tries.set(attempt, tries.get(attempt) ? tries.get(attempt) + 1 : 1);
  }

  let values = "";
  for (let i = 0; i < 6; i++) {
    values += `${tries.get(i) || 0},`;
  }
  values += tries.get(6);
  await Deno.writeTextFile("output.csv", `0,1,2,3,4,5,6\n${values}`);
};
simulate(100000);
