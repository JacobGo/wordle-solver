export type GuessResponse = {
  isCorrect: boolean;
  guess: string;
  slots: Slot[];
};
export enum Slot {
  RIGHT_SPOT,
  WRONG_SPOT,
  MISSING
}

export class Game {
  private solution: string;
  private solutionLetters: Set<string>;
  constructor(solution: string) {
    this.solution = solution;
    this.solutionLetters = new Set<string>(solution.split(""));
  }

  guess(word: string): GuessResponse {
    if (word.length !== this.solution.length) {
      throw Error(
        `length does not match, expected ${this.solution.length} letters`
      );
    }
    const slots: Slot[] = word.split("").map((letter, i) => {
      if (letter === this.solution[i]) {
        return Slot.RIGHT_SPOT;
      } else if (this.solutionLetters.has(letter)) {
        return Slot.WRONG_SPOT;
      }
      return Slot.MISSING;
    });
    return {
      isCorrect: word === this.solution,
      guess: word,
      slots
    };
  }
}
