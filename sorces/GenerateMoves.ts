// 合法手の候補リストを生成する静的クラス
class GenerateMoves {
  /* 手を指した後に自身の玉に王手がかかっていないか、
    つまり自殺手や王手放置となっていないかをチェックし、取り除く*/
  static removeSelfMate(k: Kyokumen, list: Te[]): Te[] {
    const removed: Te[] = [];
    list.forEach((te: Te): void => {
      k.move(te);

      const gyokuPosition: Position = k.searchGyoku(k.teban);

      // 玉の周辺から相手の駒が利いていたら、手に加えずリターン（forEachを一周飛ばす
      for (let direct: number = 0; direct <= 11; direct++) {
        const pos: Position = gyokuPosition.clone();
        pos.sub(direct);
        const koma: number = k.getKomaData(pos);
        if (Koma.isEnemy(k.teban, koma) && Koma.canMove(koma, direct)) {
          k.back(te);
          return;
        }
      }

      // 玉周りの８方向からの飛び利きがあったらリターン
      for (let direct: number = 0; direct <= 7; direct++) {
        const pos: Position = gyokuPosition.clone();
        let koma: number;
        do {
          pos.sub(direct);
          koma = k.getKomaData(pos);
          // 味方駒でさえぎられていたらbreak
          if (Koma.isSelf(k.teban, koma)) break;
          // 王手ではない相手の駒でさえぎられていた
          if (Koma.isEnemy(k.teban, koma)) {
            // かつ、その相手の駒はその方向に飛べるなら王手なのでリターン
            if(Koma.canJump(koma, direct)) {
              k.back(te);
              return;
            }
            // 王手ではなかったのでbreakだけ
            break;
          }
          // 駒がなかったのでもう一周
        } while (koma !== Koma.WALL);
      }
      // リターンされずにforループを抜けた。忘れずに局面を戻しておく。
      k.back(te);
      // 直接の利き、飛び利きのいずれも問題なかったのでリストに加える
      removed.push(te);
    });
    return removed;
  }

  // 与えられた配列"list"に成、不成を考慮して
  // 生成した候補手を追加する
  static addTe(k: Kyokumen, list: Te[], teban: number, koma: number, from: Position, to: Position): void {
    // 先手後手でほぼ同じ処理を二回書きたくないので
    // 先手後手で変化する条件部分だけ前もって変数にしておく
    let dan: number, fluctuation: number;
    if (teban === SENTE) {
      dan = 1;
      fluctuation = 1;
    } else {
      dan = 9;
      fluctuation = -1;
    }

    // 一段目（後手なら九段目）の歩と香は成る
    if ((Koma.getKomashu(koma) === Koma.FU || Koma.getKomashu(koma) === Koma.KYO) && to.dan === dan) {
      const te: Te = new Te(koma, from, to, true, k.getKomaData(to));
      list.push(te);
      return;
    }
    // 二段目以上（後手なら八段目以下）の桂馬は成る
    if (Koma.getKomashu(koma) === Koma.KEI && to.dan * fluctuation <= (dan + fluctuation) * fluctuation) {
      const te: Te = new Te(koma, from, to, true, k.getKomaData(to));
      list.push(te);
      return;
    }
    // 三段目以上(後手なら七段目以下)で、成れる駒は
    // 成と不成の両方を生成して追加
    if ((to.dan * fluctuation <= (dan + fluctuation * 2) * fluctuation ||
      from.dan * fluctuation <= (dan + fluctuation * 2) * fluctuation) && Koma.canPromote(koma)) {
      const tePromote: Te = new Te(koma, from, to, true, k.getKomaData(to));
      list.push(tePromote);
      const te: Te = new Te(koma, from, to, false, k.getKomaData(to));
      list.push(te);
      return;
    }
    // どれにも該当しない場合は不成のみ生成
    const te: Te = new Te(koma, from, to, false, k.getKomaData(to));
    list.push(te);
  }

  /* 打ち歩詰めになっていないかチェックする
   相手の玉頭に歩を打つ手であった場合、その手で一手すすめて
   generateLegalMovesを実行し、合法手がない場合は
   詰んでいる→打ち歩詰めということになる */
  static isUtifudume(k: Kyokumen, te: Te): boolean {
    // 駒を打つ手でなければ打ち歩詰めではない
    if (te.from.suji !== 0) return false;
    // 駒が歩でなければ打ち歩詰めではない
    if (Koma.getKomashu(te.koma) !== Koma.FU) return false;
    // 下準備。手番が入れ替わり立ち代わり必要となるので、最初に取得しておく
    let teban: number, tebanEnemy: number;
    if (Koma.isSente(te.koma)) {
      teban = SENTE;
      tebanEnemy = GOTE;
    } else {
      teban = GOTE;
      tebanEnemy = SENTE;
    }

    // 相手の玉と打った歩の位置関係をチェック
    const gyokuPosition: Position = k.searchGyoku(tebanEnemy);
    // 玉頭歩でなければリターン
    if (teban === SENTE) {
      if (gyokuPosition.suji !== te.to.suji || gyokuPosition.dan !== te.to.dan - 1) return false;
    } else {
      if (gyokuPosition.suji !== te.to.suji || gyokuPosition.dan !== te.to.dan + 1) return false;
    }
    // 玉頭歩だった。一手すすめて合法手があるかチェック
    k.move(te);
    k.teban = tebanEnemy;
    const list: Te[] = this.generateLegalMoves(k);
    // リターン前に忘れずに局面を戻す
    k.back(te);
    k.teban = teban;
    return list.length === 0 ? true : false;
  }

  // 与えられた局面における合法手を生成する
  static generateLegalMoves(k: Kyokumen): Te[] {
    const list: Te[] = [];

    // 盤上の駒を動かす手を生成
    for (let suji: number = 1; suji <= 9; suji++) {
      for (let dan: number = 1; dan <= 9; dan++) {
        const from: Position = new Position(suji, dan);
        const koma: number = k.getKomaData(from);
        // 駒が手番側の駒か確認し、手番側の駒であれば動かしてみる
        if (Koma.isSelf(k.teban, koma)) {
          // 直接動く手を生成
          this.generateOneKomaMoves(list, k, koma, from);
          // 飛び駒の手を生成
          this.generateOneKomaJumps(list, k, koma, from);
        }
      }
    }

    // 持駒を打つ手を生成
    // 手番側の持駒を参照する変数を用意
    const hand: number[] = k.teban === 0x10 ? k.hand[0] : k.hand[1];
    // 持駒を歩から飛まで順にチェックする
    for (let koma: number = Koma.FU; koma <= Koma.HI; koma++) {
      // 該当する駒が持駒になければcontinue
      if (hand[koma] === 0) continue;

      // 盤面を順にチェック
      for (let suji: number = 1; suji <= 9; suji++) {
        // 駒が歩の場合は二歩チェック
        if (koma === Koma.FU && this.isNifu(k, suji)) continue;

        for (let dan: number = 1; dan <= 9; dan++) {
          // 駒が歩、または香の場合は一段目（後手は九段目）に打てない
          if (koma === Koma.FU || koma === Koma.KYO) {
            if (k.teban === SENTE && dan === 1) continue;
            if (k.teban === GOTE && dan === 9) continue;
          }

          // 駒が桂の場合は二段目より上（後手は八段目より下）に打てない
          if (koma === 3) {
            if (k.teban === SENTE && dan <= 2) continue;
            if (k.teban === GOTE && dan <= 8) continue;
          }

          // 位置の生成
          const from: Position = new Position(0, 0);
          const to: Position = new Position(suji, dan);

          // 空きでないと駒は打てない
          if (k.getKomaData(to) !== Koma.EMPTY) continue;
          // ようやく手の生成
          const te: Te = new Te(k.teban | koma, from, to, false, Koma.EMPTY);
          // 打ち歩詰めチェック
          if (this.isUtifudume(k, te)) continue;

          // 不成のみなのでaddTeメソッドを使わずに直接push
          list.push(te);
          // なお、持駒から打った駒を減算する処理は
          // Kyokumen.moveメソッドで行われるので、手の生成時点では不要
        }
      }
    }

    // 以上で生成した手のリストから自殺手や王手放置を除外する
    return this.removeSelfMate(k, list)
  }

  // 盤上の特定の駒一つ分についての手を生成する
  static generateOneKomaMoves(list: Te[], k: Kyokumen, koma: number, from: Position): void {
    for (let direct: number = 0; direct <= 11; direct++) {
      if (Koma.canMove(koma, direct)) {
        const to: Position = from.makeMovedPosition(direct);
        // 移動先は盤内か
        if (to.suji >= 1 && to.suji <= 9 && to.dan >= 1 && to.dan <= 9) {
          // 自分の駒でふさがってないか
          if (Koma.isSelf(k.teban, k.getKomaData(to))) continue;
          // 駒を動かせる。成、不成を考慮しつつ手に追加。
          this.addTe(k, list, k.teban, koma, from, to);
        }
      }
    }
  }

  // 盤上の特定の駒一つ分の動き、飛び駒用
  static generateOneKomaJumps(list: Te[], k: Kyokumen, koma: number, from: Position): void {
    for (let direct: number = 0; direct <= 7; direct++) {
      if (Koma.canJump(koma, direct)) {
        // 飛び方向に一マスずつ動かしていく
        for(let i: number = 1; i < 9; i++) {
          let to: Position = from.clone();
          for(let j: number = 0; j < i; j++) {
            to.add(direct);
          }
          // 盤の範囲を超えていればbreak
          if (to.suji < 1 || to.suji > 9 || to.dan < 1 || to.dan > 9) break;
          // 自分の駒でふさがっている場合もbreak
          if (Koma.isSelf(k.teban, k.getKomaData(to))) break;
          // 相手の駒がある場合、１歩目ならbreak、２歩目以降なら手を生成した上でbreak
          if (Koma.isEnemy(k.teban, k.getKomaData(to))) {
            if(i !== 1) {
              this.addTe(k, list, k.teban, koma, from, to);
            }
            break;
          }
          // 盤内かつ空きだった。１歩目の場合はOneKomaMovesと被るので生成せずにcontinue
          if (i === 1) continue;
          // 盤内かつ空きであり、２歩目以降だった。手を生成して次の一歩へ
          this.addTe(k, list, k.teban, koma, from, to);
        }
      }
    }
  }

  // 二歩チェック
  static isNifu(k: Kyokumen, suji: number): boolean {
    for (let dan: number = 1; dan <= 9; dan++) {
      if (k.getKomaData({ suji, dan } as Position) === (k.teban | Koma.FU)) return true;
    }
    return false;
  }

}