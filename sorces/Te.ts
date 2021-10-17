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
    return (te.koma === this.koma && te.from.suji === this.from.suji &&
      te.from.dan === this.from.dan && te.to.suji === this.to.suji &&
      te.to.dan === this.to.dan && te.promote === this.promote);
  }

  // 引数としてTeの配列を受け取り、その配列に自身が含まれるかチェック
  contains(list: Te[]): boolean {
    for(let i: number = 0; i < list.length; i++) {
      if(this.equals(list[i])) return true;
    }
    return false;
  }

  clone(): Te {
    return new Te(this.koma, this.from, this.to, this.promote);
  }

  // 手の文字列化
  toString(): string {
    return sujiStr[this.to.suji] + danStr[this.to.dan] + Koma.toString(this.koma)
      + (this.promote ? '成' : '') + (this.from.suji === 0 ? '打    ' : `(${sujiStr[this.from.suji] + danStr[this.from.dan]})`)
      + (this.promote ? '' : '  ');
  }
}