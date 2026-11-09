// 合法手の候補リストを生成する静的クラス
class GenerateMoves {
  /* 手を指した後に自身の玉に王手がかかっていないか、
    つまり自殺手や王手放置となっていないかをチェックし、取り除く*/
  static removeSelfMate(k: Kyokumen, list: Te[]): Te[] {
    const removed: Te[] = [];
    // Kyokumen.moveは手番を変更しないので、手を指す側の手番はここで固定できる
    const teban: number = k.teban;
    for (let i: number = 0; i < list.length; i++) {
      const te: Te = list[i];
      k.move(te);
      const attacked: boolean = this.isGyokuAttacked(k, teban);
      // 忘れずに局面を戻しておく
      k.back(te);
      // 直接の利き、飛び利きのいずれも問題なかったのでリストに加える
      if (!attacked) removed.push(te);
    }
    return removed;
  }

  // tebanの側の玉に、相手の駒の利き（王手）があるかを判定する
  // Positionを生成せず、筋と段を数値のまま扱うことで軽量化している
  static isGyokuAttacked(k: Kyokumen, teban: number): boolean {
    const gyokuPosition: Position = k.searchGyoku(teban);
    const gyokuSuji: number = gyokuPosition.suji;
    const gyokuDan: number = gyokuPosition.dan;

    // 玉の周辺（桂馬飛びを含む）から相手の駒が利いていたら王手
    for (let direct: number = 0; direct <= 11; direct++) {
      const koma: number = k.getKoma(gyokuSuji - Koma.diffSuji[direct], gyokuDan - Koma.diffDan[direct]);
      if (Koma.isEnemy(teban, koma) && Koma.canMove(koma, direct)) return true;
    }

    // 玉周りの８方向からの飛び利きがあったら王手
    for (let direct: number = 0; direct <= 7; direct++) {
      const diffSuji: number = Koma.diffSuji[direct];
      const diffDan: number = Koma.diffDan[direct];
      let suji: number = gyokuSuji - diffSuji;
      let dan: number = gyokuDan - diffDan;
      // 盤内にいる間、玉から離れる方向に一マスずつ調べる
      while (suji >= 1 && suji <= 9 && dan >= 1 && dan <= 9) {
        const koma: number = k.ban[suji][dan];
        if (koma !== Koma.EMPTY) {
          // 相手の駒でさえぎられていて、その駒がその方向に飛べるなら王手
          if (Koma.isEnemy(teban, koma) && Koma.canJump(koma, direct)) return true;
          // 味方駒、または王手ではない相手の駒でさえぎられていたのでこの方向は問題なし
          break;
        }
        // 駒がなかったので一マス進める
        suji -= diffSuji;
        dan -= diffDan;
      }
    }
    return false;
  }

  // 成らずに指すことができない手（不成不可）かどうかを判定する。
  // 成らないと行き所のない駒になってしまう、次の場合に真を返す。
  //   ・歩と香が、一段目（後手なら九段目）に進む
  //   ・桂が、二段目以上（後手なら八段目以下）に進む
  // komaは動かす駒（先手後手の情報を含む）、toDanは移動先の段。
  static mustPromote(koma: number, toDan: number): boolean {
    const komashu: number = Koma.getKomashu(koma);
    if (komashu !== Koma.FU && komashu !== Koma.KYO && komashu !== Koma.KEI) return false;
    if (Koma.isSente(koma)) {
      return komashu === Koma.KEI ? toDan <= 2 : toDan === 1;
    }
    if (Koma.isGote(koma)) {
      return komashu === Koma.KEI ? toDan >= 8 : toDan === 9;
    }
    return false;
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

    // 不成不可の手（一段目（後手なら九段目）の歩と香、
    // 二段目以上（後手なら八段目以下）の桂）は成りのみ生成
    if (GenerateMoves.mustPromote(koma, to.dan)) {
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

  // 盤上の手番側の駒を動かす手を生成し、listに追加する
  // capturesOnlyがtrueの場合は、駒を取る手だけを生成する
  static generateBoardMoves(list: Te[], k: Kyokumen, capturesOnly: boolean): void {
    for (let suji: number = 1; suji <= 9; suji++) {
      const column: number[] = k.ban[suji];
      for (let dan: number = 1; dan <= 9; dan++) {
        const koma: number = column[dan];
        // 駒が手番側の駒か確認し、手番側の駒であれば動かしてみる
        // （Positionは手番側の駒のマスでだけ生成する）
        if (Koma.isSelf(k.teban, koma)) {
          const from: Position = new Position(suji, dan);
          // 直接動く手を生成
          this.generateOneKomaMoves(list, k, koma, from, capturesOnly);
          // 飛び駒の手を生成
          this.generateOneKomaJumps(list, k, koma, from, capturesOnly);
        }
      }
    }
  }

  // 駒を取る手だけを生成する（静止探索用）
  // 持駒を打つ手は駒を取らないので生成しない。打ち歩詰めのチェックも不要となり、
  // 全合法手を生成するより大幅に軽い。
  static generateCaptureMoves(k: Kyokumen): Te[] {
    const list: Te[] = [];
    this.generateBoardMoves(list, k, true);
    // 自殺手や王手放置を除外する
    return this.removeSelfMate(k, list);
  }

  // 与えられた局面における合法手を生成する
  static generateLegalMoves(k: Kyokumen): Te[] {
    const list: Te[] = [];

    // 盤上の駒を動かす手を生成
    this.generateBoardMoves(list, k, false);

    // 持駒を打つ手を生成
    // 手番側の持駒を参照する変数を用意
    const hand: number[] = k.teban === 0x10 ? k.hand[0] : k.hand[1];
    // 駒を打つ手の移動元。全ての打つ手で共有する（書き換えは行わない）
    const dropFrom: Position = new Position(0, 0);
    // 持駒を歩から飛まで順にチェックする
    for (let koma: number = Koma.FU; koma <= Koma.HI; koma++) {
      // 該当する駒が持駒になければcontinue
      if (hand[koma] === 0) continue;

      // 盤面を順にチェック
      for (let suji: number = 1; suji <= 9; suji++) {
        // 駒が歩の場合は二歩チェック
        if (koma === Koma.FU && this.isNifu(k, suji)) continue;

        const column: number[] = k.ban[suji];
        for (let dan: number = 1; dan <= 9; dan++) {
          // 駒が歩、または香の場合は一段目（後手は九段目）に打てない
          if (koma === Koma.FU || koma === Koma.KYO) {
            if (k.teban === SENTE && dan === 1) continue;
            if (k.teban === GOTE && dan === 9) continue;
          }

          // 駒が桂の場合は二段目より上（後手は八段目より下）に打てない
          if (koma === 3) {
            if (k.teban === SENTE && dan <= 2) continue;
            if (k.teban === GOTE && dan >= 8) continue;
          }

          // 空きでないと駒は打てない（Positionの生成より前に判定する）
          if (column[dan] !== Koma.EMPTY) continue;

          // 位置の生成
          const to: Position = new Position(suji, dan);
          // ようやく手の生成
          const te: Te = new Te(k.teban | koma, dropFrom, to, false, Koma.EMPTY);
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
  // capturesOnlyがtrueの場合は、駒を取る手だけを生成する
  static generateOneKomaMoves(list: Te[], k: Kyokumen, koma: number, from: Position, capturesOnly: boolean = false): void {
    for (let direct: number = 0; direct <= 11; direct++) {
      if (Koma.canMove(koma, direct)) {
        // 移動先の筋と段。Positionは手を生成する時だけ作る
        const suji: number = from.suji + Koma.diffSuji[direct];
        const dan: number = from.dan + Koma.diffDan[direct];
        // 移動先は盤内か
        if (suji >= 1 && suji <= 9 && dan >= 1 && dan <= 9) {
          const target: number = k.ban[suji][dan];
          // 自分の駒でふさがってないか
          if (Koma.isSelf(k.teban, target)) continue;
          // 駒を取る手だけが必要な場合、空きマスへの移動は不要
          if (capturesOnly && target === Koma.EMPTY) continue;
          // 駒を動かせる。成、不成を考慮しつつ手に追加。
          this.addTe(k, list, k.teban, koma, from, new Position(suji, dan));
        }
      }
    }
  }

  // 盤上の特定の駒一つ分の動き、飛び駒用
  // capturesOnlyがtrueの場合は、駒を取る手だけを生成する
  static generateOneKomaJumps(list: Te[], k: Kyokumen, koma: number, from: Position, capturesOnly: boolean = false): void {
    for (let direct: number = 0; direct <= 7; direct++) {
      if (Koma.canJump(koma, direct)) {
        const diffSuji: number = Koma.diffSuji[direct];
        const diffDan: number = Koma.diffDan[direct];
        // 飛び方向に一マスずつ動かしていく。
        // 毎回元の位置から数え直さず、前回のマスから一歩進める。
        let suji: number = from.suji + diffSuji;
        let dan: number = from.dan + diffDan;
        for(let i: number = 1; i < 9; i++) {
          // 盤の範囲を超えていればbreak
          if (suji < 1 || suji > 9 || dan < 1 || dan > 9) break;
          const target: number = k.ban[suji][dan];
          // 自分の駒でふさがっている場合もbreak
          if (Koma.isSelf(k.teban, target)) break;
          // 相手の駒がある場合、１歩目ならbreak、２歩目以降なら手を生成した上でbreak
          if (Koma.isEnemy(k.teban, target)) {
            if(i !== 1) {
              this.addTe(k, list, k.teban, koma, from, new Position(suji, dan));
            }
            break;
          }
          // 盤内かつ空きだった。
          // １歩目の場合はOneKomaMovesと被るので生成しない。
          // 駒を取る手だけが必要な場合も空きマスへの移動は生成しない。
          // それ以外（２歩目以降）は手を生成する。
          if (i !== 1 && !capturesOnly) {
            this.addTe(k, list, k.teban, koma, from, new Position(suji, dan));
          }
          // 次の一歩へ
          suji += diffSuji;
          dan += diffDan;
        }
      }
    }
  }

  // 二歩チェック
  static isNifu(k: Kyokumen, suji: number): boolean {
    const fu: number = k.teban | Koma.FU;
    const column: number[] = k.ban[suji];
    for (let dan: number = 1; dan <= 9; dan++) {
      if (column[dan] === fu) return true;
    }
    return false;
  }

}
