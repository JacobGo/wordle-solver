// 5 x 26
class IndexedFrequencyDistribution extends Map<string, number> {
  total = 0;
  constructor(dictionary: string[], index: number) {
    super();
    for (const word of dictionary) {
      const letter = word[index];
      const count = this.get(letter);
      this.set(letter, count ? count + 1 : 1);
      this.total += 1;
    }
  }
}

export class FrequencyDistributionWrapper {
  indexes;
  total = 0;
  constructor(dictionary: string[]) {
    this.indexes = Array.from(Array(5).keys()).map((index) => {
      const ifq = new IndexedFrequencyDistribution(dictionary, index);
      this.total += ifq.total;
      return ifq;
    });
  }
}
