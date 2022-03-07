export class Statistics implements IStatistics {
  start: string = "";
  end: string = "";

  constructor() {}

  markStart() {
    this.start = new Date().toISOString();
  }

  markEnd() {
    this.end = new Date().toISOString();
  }
}
