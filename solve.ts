import { Game, Slot } from "./game.ts";
import { FrequencyDistributionWrapper } from "./frequency_distribution.ts";
import { chooseRandom } from "./utils.ts";
import { parse } from "https://deno.land/std@0.120.0/flags/mod.ts";

// Silence debug output.
// console.debug = () => {};

const { tries, trials, start, saveOutput } = parse(Deno.args);
const MAX_TRIES = tries || 6;
const TRIALS = trials || 100000;
const START_WORD = start || "eases";
const SAVE_OUTPUT = saveOutput || false;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

type Guess = {
  word: string;
  confidence: string;
};

class Solver {
  /** Letter frequency distribution of the dictionary */
  private lettersFreqDist: FrequencyDistributionWrapper;
  private pool: string[];

  private game: Game;
  private tries = 0;

  constructor(
    dictionary: string[],
    lettersFreqDist: FrequencyDistributionWrapper,
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

    // The best starting word is always the same. To recalculate, remove this block.
    // if (this.tries === 1) {
    //   return { word: START_WORD, confidence: "1" };
    // }

    // Random choice algo.
    // return {
    //   word: this.tries === 1 ? START_WORD : chooseRandom(this.pool),
    //   confidence: `${((1 / this.pool.length) * 100).toPrecision(4)}%`
    // };

    /**
     * Score the best move by simulating all possible responses to all possible inputs.
     * 1. For X in alphabet, For Y in length of word
     *    - For guessing letter X in position Y, compute probability of RIGHT_SPOT, WRONG_SPOT, MISSING
     *      - P(WRONG_SPOT) = P(RIGHT_SPOT)(X, Y - 1)  + P(RIGHT_SPOT)(X, Y - 2) ... // all index except Y
     *      - P(RIGHT_SPOT) = P(RIGHT_SPOT)(X,Y)
     *      - P(MISSING) = 1 - ( P(RIGHT_SPOT)(X,Y) + P(WRONG_SPOT)(X, Y) )
     *    - For guessing letter X in position Y, compute the number of words that will be removed pending filtering.
     *      - I(WRONG_SPOT(X,Y)) => number of words removed by filtering if we get WRONG_SPOT(X,Y)
     *      - I(RIGHT_SPOT(X,Y))
     *      - I(MISSING(X,Y))
     *    - SCORE(X,Y) => P(WRONG_SPOT) * I(WRONG_SPOT) + P(RIGHT_SPOT) * I(RIGHT_SPOT) + P(MISSING) * I(MISSING)
     * 2. For W  in pool
     *    - RANK(W) => SCORE(W[0], 0) + SCORE(W[1], 1) ...
     *
     *  We need both P() and I() because just I('JJJJJ') would always filter to 0, we need to balance both.
     *  O(X * Y * P) where X -> letter, Y -> position, P -> remaining pool size
     */

    // Regenerate the distribution.
    this.lettersFreqDist = new FrequencyDistributionWrapper(dictionary);

    const pRightSpot = (letter: string, position: number) =>
      (this.lettersFreqDist.indexes[position].get(letter) || 0) /
      this.lettersFreqDist.total;
    const pWrongSpot = (letter: string, position: number) => {
      let result = 0;
      for (let i = 0; i < 5; i++) {
        if (position !== i) {
          result += pRightSpot(letter, position);
        }
      }
      return result / this.lettersFreqDist.total;
    };
    const pMissing = (letter: string, position: number) =>
      1 - (pRightSpot(letter, position) + pWrongSpot(letter, position));

    const iRightSpot = (letter: string, position: number) => {
      return this.filterPool(Slot.RIGHT_SPOT, letter, position).length;
    };
    const iWrongSpot = (letter: string, position: number) => {
      return this.filterPool(Slot.WRONG_SPOT, letter, position).length;
    };
    const iMissing = (letter: string, position: number) => {
      return this.filterPool(Slot.MISSING, letter, position).length;
    };

    const score = (letter: string, position: number) => {
      return (
        pRightSpot(letter, position) * iRightSpot(letter, position) +
        pWrongSpot(letter, position) * iWrongSpot(letter, position) +
        pMissing(letter, position) * iMissing(letter, position)
      );
    };

    const cachedScores = new Map<string, number>();
    for (let position = 0; position < 5; position++) {
      for (const letter of ALPHABET.split("")) {
        cachedScores.set(`${position}${letter}`, score(letter, position));
      }
    }

    const rank = (word: string) => {
      let result = 0;
      for (const [position, letter] of word.split("").entries()) {
        result += cachedScores.get(`${position}${letter}`) || 0;
      }
      return result;
    };

    // TODO: Maybe write as an Array.reduce instead.
    let bestWord = "";
    let bestScore = Infinity;
    for (const word of this.pool) {
      const wordScore = rank(word);
      if (wordScore < bestScore) {
        console.debug(
          `${word} (${wordScore}) beats ${bestWord} (${bestScore})`
        );
        bestWord = word;
        bestScore = wordScore;
      }
    }
    return { word: bestWord, confidence: bestScore.toString() };
  }

  filterPool(slot: Slot, letter: string, position: number): string[] {
    if (slot === Slot.RIGHT_SPOT) {
      return this.pool.filter((word) => word[position] === letter);
    } else if (slot === Slot.WRONG_SPOT) {
      return this.pool.filter(
        (word) => word.includes(letter) && word[position] !== letter
      );
    } else {
      return this.pool.filter((word) => !word.includes(letter));
    }
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
        this.pool = this.filterPool(slot, guess.word[i], i);
      }
    }
    console.debug(`Failed to find solution after ${this.tries} tries.`);
    return 0;
  }
}

const dictionary = JSON.parse(
  await Deno.readTextFile("dictionary.json")
) as string[];

const simulateAll = async () => {
  const tries = new Map<number, number>();
  const freqDist = new FrequencyDistributionWrapper(dictionary);

  for (let i = 0; i < dictionary.length; i++) {
    if (i % 1000 === 0) {
      console.log(`${(i / dictionary.length) * 100}%`);
    }
    if (i % 10 !== 0) {
      continue;
    }
    const solution = dictionary[i];
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
  console.log(`Average guesses: ${weights / (dictionary.length / 10)}`);
};

const simulateRandom = async (rounds: number) => {
  const tries = new Map<number, number>();
  const freqDist = new FrequencyDistributionWrapper(dictionary);

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
  console.log(`Average guesses: ${weights / rounds}`);
};

// simulateRandom(TRIALS);
simulateAll();
