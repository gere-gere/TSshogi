class Te {
  koma: number;
  from: Position;
  to: Position;
  promote: boolean;

  constructor(koma: number, from: Position, to: Position, promote: boolean) {
    this.koma = koma;
    this.from = from;
    this.to = to;
    this.promote = promote;
  }

  equals(te: Te): boolean {
    return (te.koma === this.koma && te.from === this.from &&
      te.to === this.to && te.promote === this.promote);
  }

  clone(): Te {
    return new Te(this.koma, this.from, this.to, this.promote);
  }

  // 手の文字列化
  toString(): string {
    return sujiStr[this.to.suji] + danStr[this.to.dan] + Koma.toString(this.koma)
      + (this.promote ? '成' : '') + (this.from.suji === 0 ? '打    ' : `(${sujiStr[this.from.suji] + danStr[this.to.dan]})`)
      + (this.promote ? '' : '  ');
  }
}