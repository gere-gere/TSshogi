class Position {
  constructor(public suji: number = 0, public dan: number = 0) {
  }

  equals(p: Position): boolean {
    return p.suji === this.suji && p.dan === this.dan;
  }

  clone(): Position {
    return new Position(this.suji, this.dan);
  }

  // 現在のPositionから駒の動いた位置を示す新規Positionインスタンスを生成する
  makeMovedPosition(direct: number): Position {
    const newPosi: Position = this.clone();
    newPosi.add(direct);
    return newPosi;
  }

  // 位置を動かす
  add(num1: number, num2?: number): void {
    if (num2 === undefined) {
      this.add(Koma.diffSuji[num1], Koma.diffDan[num1]);
    } else {
      this.suji += num1;
      this.dan += num2;
    }
  }

  // 逆方向への動き
  sub(num1: number, num2?: number): void {
    if (num2 === undefined) {
      this.sub(Koma.diffSuji[num1], Koma.diffDan[num1]);
    } else {
      this.suji -= num1;
      this.dan -= num2;
    }
  }

}