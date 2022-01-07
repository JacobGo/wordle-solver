export class FrequencyDistribution extends Map<string, number> {
  constructor(dictionary: string[]) {
    super();
    for (const word of dictionary) {
      for (const letter of word.split("")) {
        const count = this.get(letter);
        this.set(letter, count ? count + 1 : 1);
      }
    }
  }
}
