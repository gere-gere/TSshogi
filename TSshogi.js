'use strict';
/* グローバル定数 */
// 手番
const SENTE = 0x10;
const GOTE = 0x20;
// 筋を表す文字列の定義
const sujiStr = ['', '１', '２', '３', '４', '５', '６', '７', '８', '９'];
// 段を表す文字列の定義
const danStr = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
// モジュール読み込み
const fs = require('fs');
const readlineSync = require('readline-sync');
// 合法手の候補リストを生成する静的クラス
class GenerateMoves {
  /* 手を指した後に自身の玉に王手がかかっていないか、
      つまり自殺手や王手放置となっていないかをチェックし、取り除く*/
  static removeSelfMate(k, list) {
    const removed = [];
    // Kyokumen.moveは手番を変更しないので、手を指す側の手番はここで固定できる
    const teban = k.teban;
    for (let i = 0; i < list.length; i++) {
      const te = list[i];
      k.move(te);
      const attacked = this.isGyokuAttacked(k, teban);
      // 忘れずに局面を戻しておく
      k.back(te);
      // 直接の利き、飛び利きのいずれも問題なかったのでリストに加える
      if (!attacked) removed.push(te);
    }
    return removed;
  }
  // tebanの側の玉に、相手の駒の利き（王手）があるかを判定する
  // Positionを生成せず、筋と段を数値のまま扱うことで軽量化している
  static isGyokuAttacked(k, teban) {
    const gyokuPosition = k.searchGyoku(teban);
    const gyokuSuji = gyokuPosition.suji;
    const gyokuDan = gyokuPosition.dan;
    // 玉の周辺（桂馬飛びを含む）から相手の駒が利いていたら王手
    for (let direct = 0; direct <= 11; direct++) {
      const koma = k.getKoma(gyokuSuji - Koma.diffSuji[direct], gyokuDan - Koma.diffDan[direct]);
      if (Koma.isEnemy(teban, koma) && Koma.canMove(koma, direct)) return true;
    }
    // 玉周りの８方向からの飛び利きがあったら王手
    for (let direct = 0; direct <= 7; direct++) {
      const diffSuji = Koma.diffSuji[direct];
      const diffDan = Koma.diffDan[direct];
      let suji = gyokuSuji - diffSuji;
      let dan = gyokuDan - diffDan;
      // 盤内にいる間、玉から離れる方向に一マスずつ調べる
      while (suji >= 1 && suji <= 9 && dan >= 1 && dan <= 9) {
        const koma = k.ban[suji][dan];
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
  // 与えられた配列"list"に成、不成を考慮して
  // 生成した候補手を追加する
  static addTe(k, list, teban, koma, from, to) {
    // 先手後手でほぼ同じ処理を二回書きたくないので
    // 先手後手で変化する条件部分だけ前もって変数にしておく
    let dan, fluctuation;
    if (teban === SENTE) {
      dan = 1;
      fluctuation = 1;
    } else {
      dan = 9;
      fluctuation = -1;
    }
    // 一段目（後手なら九段目）の歩と香は成る
    if (
      (Koma.getKomashu(koma) === Koma.FU || Koma.getKomashu(koma) === Koma.KYO) &&
      to.dan === dan
    ) {
      const te = new Te(koma, from, to, true, k.getKomaData(to));
      list.push(te);
      return;
    }
    // 二段目以上（後手なら八段目以下）の桂馬は成る
    if (
      Koma.getKomashu(koma) === Koma.KEI &&
      to.dan * fluctuation <= (dan + fluctuation) * fluctuation
    ) {
      const te = new Te(koma, from, to, true, k.getKomaData(to));
      list.push(te);
      return;
    }
    // 三段目以上(後手なら七段目以下)で、成れる駒は
    // 成と不成の両方を生成して追加
    if (
      (to.dan * fluctuation <= (dan + fluctuation * 2) * fluctuation ||
        from.dan * fluctuation <= (dan + fluctuation * 2) * fluctuation) &&
      Koma.canPromote(koma)
    ) {
      const tePromote = new Te(koma, from, to, true, k.getKomaData(to));
      list.push(tePromote);
      const te = new Te(koma, from, to, false, k.getKomaData(to));
      list.push(te);
      return;
    }
    // どれにも該当しない場合は不成のみ生成
    const te = new Te(koma, from, to, false, k.getKomaData(to));
    list.push(te);
  }
  /* 打ち歩詰めになっていないかチェックする
     相手の玉頭に歩を打つ手であった場合、その手で一手すすめて
     generateLegalMovesを実行し、合法手がない場合は
     詰んでいる→打ち歩詰めということになる */
  static isUtifudume(k, te) {
    // 駒を打つ手でなければ打ち歩詰めではない
    if (te.from.suji !== 0) return false;
    // 駒が歩でなければ打ち歩詰めではない
    if (Koma.getKomashu(te.koma) !== Koma.FU) return false;
    // 下準備。手番が入れ替わり立ち代わり必要となるので、最初に取得しておく
    let teban, tebanEnemy;
    if (Koma.isSente(te.koma)) {
      teban = SENTE;
      tebanEnemy = GOTE;
    } else {
      teban = GOTE;
      tebanEnemy = SENTE;
    }
    // 相手の玉と打った歩の位置関係をチェック
    const gyokuPosition = k.searchGyoku(tebanEnemy);
    // 玉頭歩でなければリターン
    if (teban === SENTE) {
      if (gyokuPosition.suji !== te.to.suji || gyokuPosition.dan !== te.to.dan - 1) return false;
    } else {
      if (gyokuPosition.suji !== te.to.suji || gyokuPosition.dan !== te.to.dan + 1) return false;
    }
    // 玉頭歩だった。一手すすめて合法手があるかチェック
    k.move(te);
    k.teban = tebanEnemy;
    const list = this.generateLegalMoves(k);
    // リターン前に忘れずに局面を戻す
    k.back(te);
    k.teban = teban;
    return list.length === 0 ? true : false;
  }
  // 盤上の手番側の駒を動かす手を生成し、listに追加する
  // capturesOnlyがtrueの場合は、駒を取る手だけを生成する
  static generateBoardMoves(list, k, capturesOnly) {
    for (let suji = 1; suji <= 9; suji++) {
      const column = k.ban[suji];
      for (let dan = 1; dan <= 9; dan++) {
        const koma = column[dan];
        // 駒が手番側の駒か確認し、手番側の駒であれば動かしてみる
        // （Positionは手番側の駒のマスでだけ生成する）
        if (Koma.isSelf(k.teban, koma)) {
          const from = new Position(suji, dan);
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
  static generateCaptureMoves(k) {
    const list = [];
    this.generateBoardMoves(list, k, true);
    // 自殺手や王手放置を除外する
    return this.removeSelfMate(k, list);
  }
  // 与えられた局面における合法手を生成する
  static generateLegalMoves(k) {
    const list = [];
    // 盤上の駒を動かす手を生成
    this.generateBoardMoves(list, k, false);
    // 持駒を打つ手を生成
    // 手番側の持駒を参照する変数を用意
    const hand = k.teban === 0x10 ? k.hand[0] : k.hand[1];
    // 駒を打つ手の移動元。全ての打つ手で共有する（書き換えは行わない）
    const dropFrom = new Position(0, 0);
    // 持駒を歩から飛まで順にチェックする
    for (let koma = Koma.FU; koma <= Koma.HI; koma++) {
      // 該当する駒が持駒になければcontinue
      if (hand[koma] === 0) continue;
      // 盤面を順にチェック
      for (let suji = 1; suji <= 9; suji++) {
        // 駒が歩の場合は二歩チェック
        if (koma === Koma.FU && this.isNifu(k, suji)) continue;
        const column = k.ban[suji];
        for (let dan = 1; dan <= 9; dan++) {
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
          const to = new Position(suji, dan);
          // ようやく手の生成
          const te = new Te(k.teban | koma, dropFrom, to, false, Koma.EMPTY);
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
    return this.removeSelfMate(k, list);
  }
  // 盤上の特定の駒一つ分についての手を生成する
  // capturesOnlyがtrueの場合は、駒を取る手だけを生成する
  static generateOneKomaMoves(list, k, koma, from, capturesOnly = false) {
    for (let direct = 0; direct <= 11; direct++) {
      if (Koma.canMove(koma, direct)) {
        // 移動先の筋と段。Positionは手を生成する時だけ作る
        const suji = from.suji + Koma.diffSuji[direct];
        const dan = from.dan + Koma.diffDan[direct];
        // 移動先は盤内か
        if (suji >= 1 && suji <= 9 && dan >= 1 && dan <= 9) {
          const target = k.ban[suji][dan];
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
  static generateOneKomaJumps(list, k, koma, from, capturesOnly = false) {
    for (let direct = 0; direct <= 7; direct++) {
      if (Koma.canJump(koma, direct)) {
        const diffSuji = Koma.diffSuji[direct];
        const diffDan = Koma.diffDan[direct];
        // 飛び方向に一マスずつ動かしていく。
        // 毎回元の位置から数え直さず、前回のマスから一歩進める。
        let suji = from.suji + diffSuji;
        let dan = from.dan + diffDan;
        for (let i = 1; i < 9; i++) {
          // 盤の範囲を超えていればbreak
          if (suji < 1 || suji > 9 || dan < 1 || dan > 9) break;
          const target = k.ban[suji][dan];
          // 自分の駒でふさがっている場合もbreak
          if (Koma.isSelf(k.teban, target)) break;
          // 相手の駒がある場合、１歩目ならbreak、２歩目以降なら手を生成した上でbreak
          if (Koma.isEnemy(k.teban, target)) {
            if (i !== 1) {
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
  static isNifu(k, suji) {
    const fu = k.teban | Koma.FU;
    const column = k.ban[suji];
    for (let dan = 1; dan <= 9; dan++) {
      if (column[dan] === fu) return true;
    }
    return false;
  }
}
/* 駒に関する処理を担う静的クラス
 参考書籍ではKomaとKomaMovesを分けていたが、
 本実装では駒に関するものは全てこのクラスに集約する */
class Koma {
  static isSente(koma) {
    return (koma & SENTE) !== 0;
  }
  static isGote(koma) {
    return (koma & GOTE) !== 0;
  }
  static isSelf(teban, koma) {
    return teban === SENTE ? this.isSente(koma) : this.isGote(koma);
  }
  static isEnemy(teban, koma) {
    return teban === SENTE ? this.isGote(koma) : this.isSente(koma);
  }
  static getKomashu(koma) {
    return koma & 0x0f;
  }
  static canPromote(koma) {
    return this._PROMOTABLE.has(koma);
  }
  static canMove(koma, move) {
    // 駒種が不正なら即リターン
    const komasyu = this.getKomashu(koma);
    if (komasyu === 0 || komasyu === 13) return false;
    // 先手後手どちらの駒でもなければ即リターン
    const teban = koma & 0x30;
    if (teban === 0 || teban === 0x30) return false;
    // 後手の駒の場合は先手側に向きを揃える
    if (teban === GOTE) {
      if (move <= 7) move = 7 - move;
      if (move >= 8) move = 19 - move;
    }
    return this.moveData[komasyu][move];
  }
  // 駒の文字列化…盤面用（後手の頭に'v'が付くなど）
  static toBanString(koma) {
    if (koma === Koma.EMPTY) return '   ';
    // 先手の駒には頭に半角スペース、後手には'v'を追加
    const prefix = (koma & SENTE) !== 0 ? ' ' : 'v';
    return prefix + this.toString(koma);
  }
  // 駒の文字列化…持駒、手用
  static toString(koma) {
    return this.komaString[Koma.getKomashu(koma)];
  }
  // 香、角、飛、馬、竜など、一度に複数マスを移動できるかを判定する
  static canJump(koma, jump) {
    // 駒種が香、角、飛、馬、竜でなければ即リターン
    const komasyu = this.getKomashu(koma);
    if (!(komasyu === 2 || komasyu === 6 || komasyu === 7 || komasyu === 14 || komasyu === 15))
      return false;
    // 先手後手どちらの駒でもなければ即リターン
    const teban = koma & 0x30;
    if (teban === 0 || teban === 0x30) return false;
    // 後手の駒の場合は先手側に向きを揃える
    if (teban === GOTE) jump = 7 - jump;
    return this.jumpData[komasyu][jump];
  }
}
// 駒の基本形
Koma.EMPTY = 0;
Koma.PROMOTE = 8; //成りフラグ
Koma.FU = 1;
Koma.KYO = 2;
Koma.KEI = 3;
Koma.GIN = 4;
Koma.KIN = 5;
Koma.KAK = 6;
Koma.HI = 7;
Koma.OU = 8;
// 成り駒
Koma.TO = Koma.FU + Koma.PROMOTE;
Koma.NY = Koma.KYO + Koma.PROMOTE;
Koma.NK = Koma.KEI + Koma.PROMOTE;
Koma.NG = Koma.GIN + Koma.PROMOTE;
Koma.UMA = Koma.KAK + Koma.PROMOTE;
Koma.RYU = Koma.HI + Koma.PROMOTE;
// 先手の駒
Koma.SFU = SENTE + Koma.FU;
Koma.SKY = SENTE + Koma.KYO;
Koma.SKE = SENTE + Koma.KEI;
Koma.SGI = SENTE + Koma.GIN;
Koma.SKI = SENTE + Koma.KIN;
Koma.SKA = SENTE + Koma.KAK;
Koma.SHI = SENTE + Koma.HI;
Koma.SOU = SENTE + Koma.OU;
Koma.STO = SENTE + Koma.TO;
Koma.SNY = SENTE + Koma.NY;
Koma.SNK = SENTE + Koma.NK;
Koma.SNG = SENTE + Koma.NG;
Koma.SUM = SENTE + Koma.UMA;
Koma.SRY = SENTE + Koma.RYU;
// 後手の駒
Koma.GFU = GOTE + Koma.FU;
Koma.GKY = GOTE + Koma.KYO;
Koma.GKE = GOTE + Koma.KEI;
Koma.GGI = GOTE + Koma.GIN;
Koma.GKI = GOTE + Koma.KIN;
Koma.GKA = GOTE + Koma.KAK;
Koma.GHI = GOTE + Koma.HI;
Koma.GOU = GOTE + Koma.OU;
Koma.GTO = GOTE + Koma.TO;
Koma.GNY = GOTE + Koma.NY;
Koma.GNK = GOTE + Koma.NK;
Koma.GNG = GOTE + Koma.NG;
Koma.GUM = GOTE + Koma.UMA;
Koma.GRY = GOTE + Koma.RYU;
// 盤外の壁
Koma.WALL = 0x40;
/*　成り判定用のSetをcanPromoteメソッド呼び出しの度に生成するのは
不要な負荷が起こるので、クラス内で事前に一度だけ作っておく */
Koma._PROMOTABLE = new Set([
  Koma.SFU,
  Koma.SKY,
  Koma.SKE,
  Koma.SGI,
  Koma.SKA,
  Koma.SHI,
  Koma.GFU,
  Koma.GKY,
  Koma.GKE,
  Koma.GGI,
  Koma.GKA,
  Koma.GHI,
]);
// ここよりKomaMoves（駒の動き）についての実装
// 通常の８方向の定義(盤面上の動き)
//
//  0  1  2
//     ↑
//  3 ←駒→ 4
//     ↓
//  5  6  7
//
// 桂馬飛びの方向の定義(盤面上の動き)
//
//   8    9
//
//     桂
//
//   10   11
Koma.diffDan = [-1, -1, -1, 0, 0, 1, 1, 1, -2, -2, 2, 2];
Koma.diffSuji = [1, 0, -1, 1, -1, 1, 0, -1, 1, -1, 1, -1];
// 駒の文字列化用テーブル
Koma.komaString = [
  '  ',
  '歩',
  '香',
  '桂',
  '銀',
  '金',
  '角',
  '飛',
  '王',
  'と',
  '杏',
  '圭',
  '全',
  '',
  '馬',
  '竜',
];
/* 駒が移動可能かどうかのデータ配列
 インデックスは駒種、移動の順の二次元テーブルであり、
 先手向きのみ用意している */
Koma.moveData = [
  // EMPTY（インデックス揃え）
  [],
  // 歩
  [false, true, false, false, false, false, false, false, false, false, false, false],
  // 香
  [false, true, false, false, false, false, false, false, false, false, false, false],
  // 桂
  [false, false, false, false, false, false, false, false, true, true, false, false],
  // 銀
  [true, true, true, false, false, true, false, true, false, false, false, false],
  // 金
  [true, true, true, true, true, false, true, false, false, false, false, false],
  // 角
  [true, false, true, false, false, true, false, true, false, false, false, false],
  // 飛
  [false, true, false, true, true, false, true, false, false, false, false, false],
  // 王
  [true, true, true, true, true, true, true, true, false, false, false, false],
  // と金
  [true, true, true, true, true, false, true, false, false, false, false, false],
  // 成香
  [true, true, true, true, true, false, true, false, false, false, false, false],
  // 成桂
  [true, true, true, true, true, false, true, false, false, false, false, false],
  // 成銀
  [true, true, true, true, true, false, true, false, false, false, false, false],
  // 成金は存在しない（インデックス揃え）
  [],
  // 馬
  [true, true, true, true, true, true, true, true, false, false, false, false],
  // 竜
  [true, true, true, true, true, true, true, true, false, false, false, false],
];
Koma.jumpData = [
  // EMPTY、歩（インデックス揃え）
  [],
  [],
  // 香
  [false, true, false, false, false, false, false, false],
  // 桂、銀、金（インデックス揃え）
  [],
  [],
  [],
  // 角
  [true, false, true, false, false, true, false, true],
  // 飛
  [false, true, false, true, true, false, true, false],
  // 王、と金、成香、成桂、成銀、成金（欠番）（インデックス揃え）
  [],
  [],
  [],
  [],
  [],
  [],
  // 馬
  [true, false, true, false, false, true, false, true],
  //　竜
  [false, true, false, true, true, false, true, false],
];
class Kyokumen {
  constructor() {
    this.teban = SENTE;
    // 玉の位置をプロパティとして保持する。初期値は絶対に利きの届かない盤外。
    this.kingS = new Position(-2, -2);
    this.kingG = new Position(-2, -2);
    // 局面ハッシュ（盤上の駒と持駒の分。手番は含まず、keyHi/keyLoで加味する）。
    // 64bitを32bitずつに分けて保持する。putKomaやmove/backで差分更新される。
    // 盤面や持駒を直接書き換えた場合は、initHashで再計算すること。
    this.hashHi = 0;
    this.hashLo = 0;
    this.ban = Array(11);
    for (let i = 0; i < 11; i++) {
      this.ban[i] = new Array(11).fill(0);
    }
    this.hand = Array(2);
    // インデックス1から順に歩、香、桂・・・飛を意味し、その枚数が格納される
    // インデックス0（EMPTY）は欠番であり、未使用
    this.hand[0] = Array(8).fill(0); //先手の持駒
    this.hand[1] = Array(8).fill(0); //後手の持駒
  }
  clone() {
    const k = new Kyokumen();
    for (let suji = 0; suji < 11; suji++) {
      for (let dan = 0; dan < 11; dan++) {
        k.ban[suji][dan] = this.ban[suji][dan];
      }
    }
    k.hand[0] = this.hand[0].slice(0);
    k.hand[1] = this.hand[1].slice(0);
    k.teban = this.teban;
    k.hashHi = this.hashHi;
    k.hashLo = this.hashLo;
    return k;
  }
  // 盤上の駒と持駒から、局面ハッシュを一から計算し直す。
  // 初期配置の設定後や棋譜の読み込み後など、盤面や持駒を直接書き換えた場合に呼ぶ。
  initHash() {
    let hi = 0;
    let lo = 0;
    for (let suji = 1; suji <= 9; suji++) {
      for (let dan = 1; dan <= 9; dan++) {
        const koma = this.ban[suji][dan];
        if (koma === Koma.EMPTY) continue;
        const idx = koma * Zobrist.SQUARES + (suji - 1) * 9 + (dan - 1);
        hi ^= Zobrist.boardHi[idx];
        lo ^= Zobrist.boardLo[idx];
      }
    }
    for (let side = 0; side < 2; side++) {
      for (let koma = Koma.FU; koma <= Koma.HI; koma++) {
        const idx = (side * 8 + koma) * Zobrist.HAND_MAX + this.hand[side][koma];
        hi ^= Zobrist.handHi[idx];
        lo ^= Zobrist.handLo[idx];
      }
    }
    this.hashHi = hi;
    this.hashLo = lo;
  }
  // 手番を加味した局面のキー（上位32bit）。置換表や千日手判定ではこちらを使う。
  // 手番は外部から直接書き換えられるため、ここで加味する。
  keyHi() {
    return this.teban === GOTE ? this.hashHi ^ Zobrist.tebanHi : this.hashHi;
  }
  // 手番を加味した局面のキー（下位32bit）
  keyLo() {
    return this.teban === GOTE ? this.hashLo ^ Zobrist.tebanLo : this.hashLo;
  }
  equals(k) {
    // 手番の比較
    if (k.teban !== this.teban) return false;
    // 盤面の比較
    for (let suji = 1; suji <= 9; suji++) {
      for (let dan = 1; dan <= 9; dan++) {
        if (k.ban[suji][dan] !== this.ban[suji][dan]) return false;
      }
    }
    // 持駒の比較
    for (let i = 1; i <= 7; i++) {
      if (k.hand[0][i] !== this.hand[0][i]) return false;
      if (k.hand[1][i] !== this.hand[1][i]) return false;
    }
    // 全て一致していた
    return true;
  }
  // 盤上の特定地点の駒情報の取得
  getKomaData(p) {
    return this.getKoma(p.suji, p.dan);
  }
  // 盤上の特定地点の駒情報の取得（筋と段を数値で渡す版。Positionの生成が不要）
  getKoma(suji, dan) {
    if (suji < 1 || suji > 9 || dan < 1 || dan > 9) return Koma.WALL;
    return this.ban[suji][dan];
  }
  // 指定位置に駒を置く（局面ハッシュも差分更新する）
  putKoma(p, koma) {
    const sq = (p.suji - 1) * 9 + (p.dan - 1);
    const old = this.ban[p.suji][p.dan];
    if (old !== Koma.EMPTY) {
      this.hashHi ^= Zobrist.boardHi[old * Zobrist.SQUARES + sq];
      this.hashLo ^= Zobrist.boardLo[old * Zobrist.SQUARES + sq];
    }
    if (koma !== Koma.EMPTY) {
      this.hashHi ^= Zobrist.boardHi[koma * Zobrist.SQUARES + sq];
      this.hashLo ^= Zobrist.boardLo[koma * Zobrist.SQUARES + sq];
    }
    this.ban[p.suji][p.dan] = koma;
  }
  // 持駒の枚数をdelta枚増減する（局面ハッシュも差分更新する）。
  // sideは0が先手、1が後手。
  changeHand(side, koma, delta) {
    const old = this.hand[side][koma];
    const now = old + delta;
    this.hand[side][koma] = now;
    // 駒種0（王など、本来は持駒にならないもの）はハッシュに含めない
    if (koma >= Koma.FU && koma <= Koma.HI) {
      const base = (side * 8 + koma) * Zobrist.HAND_MAX;
      this.hashHi ^= Zobrist.handHi[base + old] ^ Zobrist.handHi[base + now];
      this.hashLo ^= Zobrist.handLo[base + old] ^ Zobrist.handLo[base + now];
    }
  }
  // 与えられた手で一手すすめてみる
  // 自身の駒を取るような手は渡されないことが保証されている
  //（このメソッド内ではその判定はしない）
  move(te) {
    // 駒を取る手であればその駒を持駒にする
    if (te.capture !== Koma.EMPTY) {
      const koma = te.capture & 0x07; // 成フラグや先手後手フラグをクリア
      if (Koma.isSente(te.capture)) {
        this.changeHand(1, koma, 1);
      } else {
        this.changeHand(0, koma, 1);
      }
    }
    // 持駒を打つ手だった場合はその持駒を減らす
    if (te.from.suji === 0) {
      const koma = te.koma & 0x07;
      if (Koma.isSente(te.koma)) {
        this.changeHand(0, koma, -1);
      } else {
        this.changeHand(1, koma, -1);
      }
    } else {
      //盤上の駒だった場合は元の位置をEMPTYに
      this.putKoma(te.from, Koma.EMPTY);
    }
    // 駒を移動先に進める
    const koma = te.promote ? te.koma | Koma.PROMOTE : te.koma;
    this.putKoma(te.to, koma);
    // 玉の位置を更新
    if (te.koma === Koma.SOU) {
      this.kingS = te.to;
    } else if (te.koma === Koma.GOU) {
      this.kingG = te.to;
    }
  }
  // 手を一手巻き戻す（moveの逆）
  back(te) {
    // 取った駒を元に戻す（取ってないならEMPTYに戻す）
    this.putKoma(te.to, te.capture);
    // 取った駒があった場合、戻した持駒を減らす
    if (te.capture !== Koma.EMPTY) {
      const koma = te.capture & 0x07;
      // 持駒を減らす
      if (Koma.isSente(te.capture)) {
        this.changeHand(1, koma, -1);
      } else {
        this.changeHand(0, koma, -1);
      }
    }
    // 打ち駒だった場合、持駒に戻す
    if (te.from.suji === 0) {
      const koma = te.koma & 0x07;
      if (Koma.isSente(te.koma)) {
        this.changeHand(0, koma, 1);
      } else {
        this.changeHand(1, koma, 1);
      }
      // 打駒でなかった場合、元の位置に戻す
    } else {
      this.putKoma(te.from, te.koma);
    }
    // 玉であった場合は玉の位置情報を戻す
    if (te.koma === Koma.SOU) {
      this.kingS = te.from;
    } else if (te.koma === Koma.GOU) {
      this.kingG = te.from;
    }
  }
  // 玉の位置を再探索し設定
  researchGyoku() {
    this.kingS.change(-2, -2);
    this.kingG.change(-2, -2);
    for (let suji = 1; suji <= 9; suji++) {
      for (let dan = 1; dan <= 9; dan++) {
        if (this.ban[suji][dan] === Koma.SOU) {
          this.kingS.change(suji, dan);
        } else if (this.ban[suji][dan] === Koma.GOU) {
          this.kingG.change(suji, dan);
        }
      }
    }
  }
  // 玉位置を取得
  searchGyoku(teban) {
    return teban === SENTE ? this.kingS : this.kingG;
  }
  // 棋譜（文字列の配列へ変換済）を受け取り局面に反映させる
  readCsaKifu(csaKifu) {
    // 駒箱に入っている残り駒
    const restKoma = Array(8).fill(0);
    // 最初は玉以外全部、駒箱に入ってる
    restKoma[Koma.FU] = 18;
    restKoma[Koma.KYO] = 4;
    restKoma[Koma.KEI] = 4;
    restKoma[Koma.GIN] = 4;
    restKoma[Koma.KIN] = 4;
    restKoma[Koma.KAK] = 2;
    restKoma[Koma.HI] = 2;
    // 盤面を初期化
    for (let suji = 1; suji <= 9; suji++) {
      for (let dan = 1; dan <= 9; dan++) {
        this.ban[suji][dan] = Koma.EMPTY;
      }
    }
    // 棋譜読み込みと解析
    // 棋譜構造についてはCSA棋譜形式のプロトコル熟読のこと
    // 現時点では開始局面の生成にのみ対応している
    for (let i = 0; i < csaKifu.length; i++) {
      const line = csaKifu[i];
      // 'PI'は初期配置。ただし駒落ちは非対応
      if (line.startsWith('PI')) {
        // 将棋盤を[suji][dan]のテーブルに直すと反時計回りに90度回した形となる
        // 配列の先頭と末尾は0段目、10段目（つまり盤外）となるので常に0
        this.ban[1] = [0, Koma.GKY, 0, Koma.GFU, 0, 0, 0, Koma.SFU, 0, Koma.SKY, 0];
        this.ban[2] = [0, Koma.GKE, Koma.GKA, Koma.GFU, 0, 0, 0, Koma.SFU, Koma.SHI, Koma.SKE, 0];
        this.ban[3] = [0, Koma.GGI, 0, Koma.GFU, 0, 0, 0, Koma.SFU, 0, Koma.SGI, 0];
        this.ban[4] = [0, Koma.GKI, 0, Koma.GFU, 0, 0, 0, Koma.SFU, 0, Koma.SKI, 0];
        this.ban[5] = [0, Koma.GOU, 0, Koma.GFU, 0, 0, 0, Koma.SFU, 0, Koma.SOU, 0];
        this.ban[6] = [0, Koma.GKI, 0, Koma.GFU, 0, 0, 0, Koma.SFU, 0, Koma.SKI, 0];
        this.ban[7] = [0, Koma.GGI, 0, Koma.GFU, 0, 0, 0, Koma.SFU, 0, Koma.SGI, 0];
        this.ban[8] = [0, Koma.GKE, Koma.GHI, Koma.GFU, 0, 0, 0, Koma.SFU, Koma.SKA, Koma.SKE, 0];
        this.ban[9] = [0, Koma.GKY, 0, Koma.GFU, 0, 0, 0, Koma.SFU, 0, Koma.SKY, 0];
        // 一応、駒箱も空にしておく
        for (let koma = Koma.FU; koma <= Koma.HI; koma++) {
          restKoma[koma] = 0;
        }
        continue;
      }
      // 余った持駒を一括で一方の持駒とする'P+00AL','P-00AL'、
      // また、駒別単独表現にも対応する
      if (line.startsWith('P+') || line.startsWith('P-')) {
        let flag;
        line.startsWith('P+') ? (flag = 0) : (flag = 1);
        if (line === 'P+00AL' || line === 'P-00AL') {
          // 残りの駒を全てflag側の持駒に移す
          for (let koma = Koma.FU; koma <= Koma.HI; koma++) {
            this.hand[flag][koma] = restKoma[koma];
          }
        } else {
          // 棋譜文字列から駒情報を抜き取る
          for (let j = 0; j <= line.length - 6; j += 4) {
            const sujiDanStr = line.substr(j + 2, 2);
            const komaStr = line.substr(j + 4, 2);
            let koma = Kyokumen.csaKomaTbl.indexOf(komaStr);
            // 00なら持駒へ
            if (sujiDanStr === '00') {
              this.hand[flag][koma & 0x07]++;
            } else {
              // それ以外は筋と段を解析の上、盤上へ
              const suji = parseInt(sujiDanStr.substr(0, 1));
              const dan = parseInt(sujiDanStr.substr(1, 1));
              this.ban[suji][dan] = koma | (flag === 0 ? SENTE : GOTE);
            }
            restKoma[koma & 0x07]--; // 駒箱から減らす
          }
        }
        continue;
      }
      // 一括表現による盤面への駒の配置
      if (line.startsWith('P')) {
        const dan = parseInt(line.substr(1, 1));
        if (Number.isNaN(dan)) throw 'dan is not a number.'; // 棋譜に変な値が入っていたら一応エラー投げとく
        for (let suji = 1; suji <= 9; suji++) {
          // 将棋の筋は右から始まるので逆に読んでいく
          const komaStr = line.substr(2 + (9 - suji) * 3, 3);
          let koma = Kyokumen.csaKomaTbl.indexOf(komaStr);
          if (koma === -1) {
            koma = Koma.EMPTY; // 該当する駒がない＞EMPTY
          } else {
            restKoma[koma & 0x07]--; // 駒箱から減らす
          }
          this.ban[suji][dan] = koma;
        }
        continue;
      }
      if (line === '+') {
        this.teban = SENTE;
        continue;
      }
      if (line === '-') {
        this.teban = GOTE;
      }
    }
  }
  // 局面表示のための文字列化
  toString() {
    let s = '';
    for (let koma = Koma.FU; koma <= Koma.HI; koma++) {
      for (let i = 0; i < this.hand[1][koma]; i++) {
        s += Koma.toString(koma);
      }
    }
    s += '\n';
    // 盤面表示
    s += '  9   8   7   6   5   4   3   2   1\n';
    s += '+---+---+---+---+---+---+---+---+---+\n';
    for (let dan = 1; dan <= 9; dan++) {
      for (let suji = 9; suji >= 1; suji--) {
        s += '|';
        s += Koma.toBanString(this.ban[suji][dan]);
      }
      s += '|' + danStr[dan] + '\n';
      s += '+---+---+---+---+---+---+---+---+---+\n';
    }
    for (let koma = Koma.FU; koma <= Koma.HI; koma++) {
      for (let i = 0; i < this.hand[0][koma]; i++) {
        s += Koma.toString(koma);
      }
    }
    s += '\n';
    return s;
  }
  // 局面評価関数。現時点では駒の価値の総和に過ぎないが、
  // 評価方法を発展させる際はここに各基準を追記していく
  evaluate() {
    let eva = 0;
    // 盤上の駒の価値を全て加算
    for (let suji = 1; suji <= 9; suji++) {
      for (let dan = 1; dan <= 9; dan++) {
        const koma = this.ban[suji][dan];
        // 位置による価値調整用の係数
        let coefficient = 1;
        // 下段の香車に力有り
        if (koma === Koma.SKY) {
          coefficient = 0.91 + dan * 0.01;
        } else if (koma === Koma.GKY) {
          coefficient = 1.01 - dan * 0.01;
        }
        // 桂馬の高跳び歩の餌食
        if (koma === Koma.SKE) {
          coefficient = 0.991 + dan * 0.001;
        } else if (koma === Koma.GKE) {
          coefficient = 1.001 - dan * 0.001;
        }
        eva += Kyokumen.komaValue[koma] * coefficient;
      }
    }
    // 持駒の価値を全て加算
    for (let teban = 0; teban < 2; teban++) {
      for (let koma = 1; koma < 8; koma++) {
        const sign = teban === 0 ? 1 : -1;
        // 歩は枚数が増える毎に価値が目減りする。一枚目（歩切れでない）は少し価値が上がる。
        const coefficient = koma !== Koma.FU ? 1 : 1.05 - this.hand[teban][1] * 0.03;
        eva += this.hand[teban][koma] * Kyokumen.komaValue[koma] * coefficient * sign;
      }
    }
    return eva;
  }
}
// ここよりファイル入出力
// CSA形式の棋譜ファイル文字列
Kyokumen.csaKomaTbl = [
  '   ',
  'FU',
  'KY',
  'KE',
  'GI',
  'KI',
  'KA',
  'HI',
  'OU',
  'TO',
  'NY',
  'NK ',
  'NG',
  '',
  'UM',
  'RY',
  '',
  '+FU',
  '+KY',
  '+KE',
  '+GI',
  '+KI',
  '+KA',
  '+HI',
  '+OU',
  '+TO',
  '+NY',
  '+NK',
  '+NG',
  '',
  '+UM',
  '+RY',
  '',
  '-FU',
  '-KY',
  '-KE',
  '-GI',
  '-KI',
  '-KA',
  '-HI',
  '-OU',
  '-TO',
  '-NY',
  '-NK',
  '-NG',
  '',
  '-UM',
  '-RY',
];
// 局面評価のための駒の価値
Kyokumen.komaValue = [
  0,
  100,
  290,
  370,
  480,
  580,
  900,
  1070, // 先手後手どちらでもない空～飛まで
  10000,
  580,
  580,
  580,
  580,
  0,
  1200,
  1400, // 先手後手どちらでもない王～成駒～竜まで
  0,
  100,
  290,
  370,
  480,
  580,
  900,
  1070, // 無、先手の歩～飛
  10000,
  580,
  580,
  580,
  580,
  0,
  1200,
  1400, // 先手の王～成駒～竜
  0,
  -100,
  -290,
  -370,
  -480,
  -580,
  -900,
  -1070, // 無、後手の歩～飛
  -10000,
  -580,
  -580,
  -580,
  -580,
  0,
  -1200,
  -1400, // 後手の王～成駒～竜
];
// 起動時に走るMainクラス。静的。
class Main {
  // 起動時に呼び出されるメイン関数
  // 引数としてPlyer情報を受け取る
  static main(sente, gote) {
    // プレイヤー情報の処理。senteだけ受け取りgoteが省略された場合は
    // goteはAIとする。両方とも省略されている場合は
    // sente：Human、gote：AIとする。
    if (!sente && !gote) {
      this.player[0] = new Human();
      this.player[1] = new Sikou();
    } else if (sente && !gote) {
      this.player[0] = sente.toUpperCase() === 'HUMAN' ? new Human() : new Sikou();
      this.player[1] = new Sikou();
    } else {
      this.player[0] = sente?.toUpperCase() === 'HUMAN' ? new Human() : new Sikou();
      this.player[1] = gote?.toUpperCase() === 'HUMAN' ? new Human() : new Sikou();
    }
    const k = new Kyokumen();
    if (!process.argv[2]) {
      k.teban = SENTE;
      k.ban = this.shokiBanmen;
    } else {
      const filename = process.argv[2];
      let kifu;
      const kifuStr = fs.readFileSync('./kifu/' + filename, 'utf-8');
      kifu = kifuStr.split('\n');
      k.readCsaKifu(kifu);
    }
    // 玉位置情報をセット
    k.researchGyoku();
    // 局面ハッシュを計算（盤面を直接設定したため、ここで一から計算する）
    k.initHash();
    /* テスト用の表示
        // この局面における合法手も表示してみる
        console.log(k.toString());
        const legalTe: Te[] = GenerateMoves.generateLegalMoves(k);
        let teStr: string = '';
        console.log(`可能手：${legalTe.length}手`);
        for(let i: number = 0; i < legalTe.length; i++) {
          if(i !== 0) teStr += ', ';
          teStr += legalTe[i].toString();
        }
        console.log(teStr);
        */
    // 対戦のメインループ
    while (true) {
      // 現在の局面を履歴に残す
      this.kyokumenHistory.push(k.clone());
      // 現在の局面での合法手を生成
      const legalTe = GenerateMoves.generateLegalMoves(k);
      // 合法手が一つもない＝詰み
      if (legalTe.length === 0) {
        console.log(k.teban === SENTE ? '後手の勝ち\n' : '先手の勝ち\n');
        break;
      }
      // 千日手チェック。連続王手の千日手には未対応。
      // 局面ハッシュ（手番を含む）が一致した場合だけ、念のため全盤面を比較して確定させる。
      // （盤面の比較は、ハッシュが一致したときしか行われないため、ほぼ負荷にならない）
      let sameKyokumen = 0;
      const hi = k.keyHi();
      const lo = k.keyLo();
      this.kyokumenHistory.forEach((kyokumen) => {
        if (kyokumen.keyHi() === hi && kyokumen.keyLo() === lo && k.equals(kyokumen))
          sameKyokumen++;
      });
      if (sameKyokumen >= 4) {
        console.log('【 千日手 】\n');
        break;
      }
      // 局面表示
      console.log(k.toString());
      let nextTe = k.teban === SENTE ? this.player[0].getNextTe(k) : this.player[1].getNextTe(k);
      // 指し手を表示
      console.log(nextTe.toString());
      // 指し手が合法手に含まれない場合は反則負け
      // 入力として合法手以外を受け付けないようにする処理は
      // UI側で対応することとする（現状、非対応）
      // 投了も不完全な対応（反則負け扱いとなる）
      if (!nextTe.contains(legalTe)) {
        console.log('合法手でない手が指されました。\n【 反則負け 】\n');
        console.log(k.teban === SENTE ? '後手の勝ち\n' : '先手の勝ち\n');
        break;
      }
      // 指し手で局面を進める
      k.move(nextTe);
      k.teban = k.teban === SENTE ? GOTE : SENTE;
    }
    // 対局終了
    console.log('【 終了図 】');
    console.log(k.toString());
  }
}
Main.shokiBanmen = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, Koma.GKY, 0, Koma.GFU, 0, 0, 0, Koma.SFU, 0, Koma.SKY, 0],
  [0, Koma.GKE, Koma.GKA, Koma.GFU, 0, 0, 0, Koma.SFU, Koma.SHI, Koma.SKE, 0],
  [0, Koma.GGI, 0, Koma.GFU, 0, 0, 0, Koma.SFU, 0, Koma.SGI, 0],
  [0, Koma.GKI, 0, Koma.GFU, 0, 0, 0, Koma.SFU, 0, Koma.SKI, 0],
  [0, Koma.GOU, 0, Koma.GFU, 0, 0, 0, Koma.SFU, 0, Koma.SOU, 0],
  [0, Koma.GKI, 0, Koma.GFU, 0, 0, 0, Koma.SFU, 0, Koma.SKI, 0],
  [0, Koma.GGI, 0, Koma.GFU, 0, 0, 0, Koma.SFU, 0, Koma.SGI, 0],
  [0, Koma.GKE, Koma.GHI, Koma.GFU, 0, 0, 0, Koma.SFU, Koma.SKA, Koma.SKE, 0],
  [0, Koma.GKY, 0, Koma.GFU, 0, 0, 0, Koma.SFU, 0, Koma.SKY, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];
// プレイヤー情報（AIかHumanか）
Main.player = [];
// 局面履歴
Main.kyokumenHistory = [];
/* 入力ルール
  1）盤上の駒を動かす場合、移動元の位置を二桁の数字で
  続けて移動先の位置を二桁の数字で、合わせて四桁の数字で入力する。
    初手２六歩の場合は「2726」となる。
  2)成る時は末尾に「*」を付ける。
    ２三歩成の場合は「2423*」となる。
  3)持駒を打つ際は移動元の代わりに先頭二桁で駒種を表す。
    ３三角打の場合は「0633」となる。
  4)投了の際は「%TORYO」と入力する。
  5)デバッグ用：「p」で合法手一覧を生成
*/
class Human {
  getNextTe(k) {
    // 指し手を格納する変数。投了で初期化済。
    // 正しい入力があれば合法手で書き換えられる。
    const toryoPosi = new Position(0, 0);
    let te = new Te(0, toryoPosi, toryoPosi, false, Koma.EMPTY);
    // まずは合法手の生成
    const legalTe = GenerateMoves.generateLegalMoves(k);
    do {
      console.log(k.teban === SENTE ? '先手番です\n' : '後手番です\n');
      // 入力待ち
      let input = readlineSync.question('move?: ');
      // 入力が投了であれば投了となる手を生成して終了
      if (input.toUpperCase() === '%TORYO') {
        break;
      }
      // コマンドpであれば合法手一覧を出力
      if (input === 'p') {
        let teStr = '';
        console.log(`可能手：${legalTe.length}手`);
        for (let i = 0; i < legalTe.length; i++) {
          if (i !== 0) teStr += ', ';
          teStr += legalTe[i].toString();
        }
        console.log(teStr);
        continue;
      }
      // 入力内容を解析
      let promote = false;
      if (input.length === 5) {
        if (input.charAt(4) === '*') {
          promote = true;
        } else {
          console.log('入力内容が不正です（再入力）');
          continue;
        }
      }
      let fromSuji = 0,
        fromDan = 0,
        toSuji = 0,
        toDan = 0;
      fromSuji = parseInt(input.charAt(0));
      fromDan = parseInt(input.charAt(1));
      toSuji = parseInt(input.charAt(2));
      toDan = parseInt(input.charAt(3));
      if (
        Number.isNaN(fromSuji) ||
        Number.isNaN(fromDan) ||
        Number.isNaN(toSuji) ||
        Number.isNaN(toDan)
      ) {
        console.log('入力内容が不正です（再入力）');
        continue;
      }
      let koma = 0;
      // 先頭が0ならば駒打ち
      if (fromSuji === 0) {
        koma = fromDan | k.teban;
        fromDan = 0;
      }
      const from = new Position(fromSuji, fromDan);
      const to = new Position(toSuji, toDan);
      if (fromSuji !== 0) {
        // 駒を打つ手でない場合は駒を取得
        koma = k.getKomaData(from);
      }
      te = new Te(koma, from, to, promote, k.getKomaData(to));
      if (!te.contains(legalTe)) {
        console.log('合法手ではありません（再入力）');
        continue;
      }
      // 全て問題なければループを抜ける
      break;
    } while (true);
    return te;
  }
}
class Sikou {
  // 一部の項目だけを指定してもよい。省略した項目はDEFAULT_CONFIGの値となる。
  constructor(config = {}) {
    this.config = { ...Sikou.DEFAULT_CONFIG, ...config };
    this.tt = this.config.ttBits > 0 ? new TranspositionTable(this.config.ttBits) : null;
  }
  // 詰みを表す評価値は「根からの深さ」を含んでいるため、
  // 置換表には「その局面からの詰みまでの手数」の形に直して保存する。
  // （同じ局面でも、根からの深さが違えば評価値の見え方が変わるため）
  static toTTScore(score, ply) {
    if (score >= Sikou.MATE_BOUND) return score + ply;
    if (score <= -Sikou.MATE_BOUND) return score - ply;
    return score;
  }
  // 置換表から取り出した評価値を、現在の根からの深さに合わせた値に直す
  static fromTTScore(score, ply) {
    if (score >= Sikou.MATE_BOUND) return score - ply;
    if (score <= -Sikou.MATE_BOUND) return score + ply;
    return score;
  }
  getNextTe(k) {
    // 局面ハッシュを念のため計算し直す。（盤面を直接書き換えた場合などに
    // 差分更新の結果とずれていても、探索の起点を正しくするため）
    k.initHash();
    if (this.tt !== null) this.tt.newGeneration();
    // 手を格納する変数。投了で初期化しておく。
    const start = Date.now();
    let te = new Te(0, new Position(0, 0), new Position(0, 0), false, Koma.EMPTY);
    const eva = this.negaMax(te, k, -Sikou.INFINITE, Sikou.INFINITE, 0, this.config.depth);
    const end = Date.now();
    console.log(`（探索時間：${end - start} ms　評価値：${Math.floor(eva)}）`);
    return te;
  }
  // 入れ物となるteを受け取り、評価が最大となるTeを格納する
  // また、その評価値をreturnする
  // ネガαβ法では常に指し手側を正とし、最大評価を求める
  negaMax(te, k, alpha, beta, depth, depthMax) {
    // 探索深さが最大に達していたら、駒の取り合いが落ち着くまで
    // 静止探索で読み進めた上で評価を行い、探索終了
    if (depth >= depthMax) {
      return this.quiescence(k, alpha, beta, 0);
    }
    // この局面からの残りの探索深さ
    const remaining = depthMax - depth;
    // 置換表を参照する。見つかったエントリの最善手は、手の並べ替えで先頭にする。
    const tt = this.tt;
    let hi = 0;
    let lo = 0;
    let ttMove = 0;
    if (tt !== null) {
      hi = k.keyHi();
      lo = k.keyLo();
      if (tt.probe(hi, lo)) {
        ttMove = tt.hitMove;
        // 十分深く読んだ結果であれば、探索せずにその評価値を使う。
        // ただし根（depth 0）では、指す手を確定させる必要があるため使わない。
        if (depth > 0 && tt.hitDepth >= remaining) {
          const score = Sikou.fromTTScore(tt.hitScore, depth);
          if (tt.hitFlag === TranspositionTable.EXACT) return score;
          if (tt.hitFlag === TranspositionTable.LOWER && score >= beta) return score;
          if (tt.hitFlag === TranspositionTable.UPPER && score <= alpha) return score;
        }
      }
    }
    // 探索前のαを保存しておく（置換表に保存する評価値の種類の判定に使う）
    const alphaOrig = alpha;
    // まずは合法手の生成
    let legalTe = GenerateMoves.generateLegalMoves(k);
    // 合法手がない＝この局面の手番側は詰まされている。
    // 早く詰ませる（遅く詰まされる）ほど評価が高くなるよう、深さを加味する
    if (legalTe.length === 0) {
      return -(Sikou.INFINITE - depth);
    }
    // 良さそうな手から先に読むことで、βカットが起こりやすくなる
    Sikou.orderMoves(legalTe, ttMove);
    // 最大となる候補手の評価値
    let maxEva = -Sikou.INFINITE;
    // 合法手の内の一つを一手指してみて、その評価値を取得
    // 評価値が良ければmaxTe、maxEvaを更新
    for (let i = 0; i < legalTe.length; i++) {
      const tempTe = legalTe[i];
      k.move(tempTe);
      k.teban = k.teban === SENTE ? GOTE : SENTE;
      // 次の局面の評価値を更に探索する
      // nextTempTeは現時点では次の深さに渡すダミーでしかない（読み筋を表示する際は必要となる
      let nextTempTe = new Te(0, new Position(0, 0), new Position(0, 0), false, Koma.EMPTY);
      const tempEva = -this.negaMax(nextTempTe, k, -beta, -alpha, depth + 1, depthMax);
      // 忘れずに局面を戻す
      k.back(tempTe);
      k.teban = k.teban === SENTE ? GOTE : SENTE;
      // 評価値およびαβの更新、βカット
      if (tempEva > maxEva) {
        maxEva = tempEva;
        if (maxEva > alpha) alpha = maxEva;
        te.koma = tempTe.koma;
        te.from = tempTe.from;
        te.to = tempTe.to;
        te.promote = tempTe.promote;
        te.capture = tempTe.capture;
        if (tempEva >= beta) break;
      }
    }
    // （詰みスコアに深さを加味しているため通常は発生しないが、念のための安全策）
    // maxEvaが-INFINITE、つまり何を指しても詰んでいる状態であった場合、
    // teが何も更新されないままreturnしてしまうことになる。
    // それを防ぐために先頭の指し手をteにsetする。
    // （深さ０ではnegaMaxを呼び出す前に詰みチェックが行われているので
    // 少なくとも一つは合法手が存在することが保証されている）
    if (maxEva === -Sikou.INFINITE && legalTe.length !== 0) {
      te.koma = legalTe[0].koma;
      te.from = legalTe[0].from;
      te.to = legalTe[0].to;
      te.promote = legalTe[0].promote;
      te.capture = legalTe[0].capture;
    }
    // 置換表に結果を保存する。
    // 評価値の種類は、探索前のαとβに対する結果の位置で決まる。
    //   α以下：どの手もαを超えられなかった（実際の評価値はこれ以下）
    //   β以上：βカットが起きた（実際の評価値はこれ以上）
    //   その間：正確な評価値
    // 上限の場合は最善手が定まっていないため、手は保存しない。
    if (tt !== null) {
      let flag;
      if (maxEva <= alphaOrig) {
        flag = TranspositionTable.UPPER;
      } else if (maxEva >= beta) {
        flag = TranspositionTable.LOWER;
      } else {
        flag = TranspositionTable.EXACT;
      }
      const move = flag === TranspositionTable.UPPER ? 0 : TranspositionTable.packMove(te);
      tt.store(hi, lo, remaining, Sikou.toTTScore(maxEva, depth), flag, move);
    }
    // 評価値を返す
    return maxEva;
  }
  // 手の並べ替え（move ordering）の優先度。大きいほど先に読む。
  // ・駒を取る手を最優先とし、取られる駒の価値が高いほど、
  //   また取る側の駒の価値が低いほど優先する（MVV-LVA）
  // ・成る手は、成ることによる駒の価値の増加分だけ優先する
  // ・それ以外（駒を取らない、成らない手）は同順位
  // ttMoveは置換表に保存されていた最善手（packMoveで圧縮したもの、無ければ0）。
  // 一致する手は、他のどの手よりも優先する。
  static scoreMove(te, ttMove) {
    let score = 0;
    if (ttMove !== 0 && TranspositionTable.packMove(te) === ttMove) {
      score += 10000000;
    }
    if (te.capture !== Koma.EMPTY) {
      const victim = Math.abs(Kyokumen.komaValue[te.capture]);
      const attacker = Math.abs(Kyokumen.komaValue[te.koma]);
      score += 100000 + victim * 10 - attacker;
    }
    if (te.promote) {
      const gain =
        Math.abs(Kyokumen.komaValue[te.koma | Koma.PROMOTE]) -
        Math.abs(Kyokumen.komaValue[te.koma]);
      score += 1000 + gain;
    }
    return score;
  }
  // 与えられた手のリストを、優先度の高い順にその場で並べ替える。
  // 優先度が同じ手は元の順序を保つ（安定）。
  // リストは短く、同順位の手が多いため、挿入ソートを用いる。
  static orderMoves(list, ttMove = 0) {
    const n = list.length;
    const scores = new Array(n);
    for (let i = 0; i < n; i++) {
      scores[i] = Sikou.scoreMove(list[i], ttMove);
    }
    for (let i = 1; i < n; i++) {
      const te = list[i];
      const score = scores[i];
      let j = i - 1;
      while (j >= 0 && scores[j] < score) {
        list[j + 1] = list[j];
        scores[j + 1] = scores[j];
        j--;
      }
      list[j + 1] = te;
      scores[j + 1] = score;
    }
  }
  // 静止探索。探索深さの限界に達した局面で、駒の取り合いが落ち着くまで
  // 「駒を取る手」だけを読み進めてから評価する（水平線効果の緩和）。
  // 取り合いに加わらない選択（stand pat）も許し、現局面の評価値を下限として扱う。
  // 現状は詰みの検出や王手への対応は行わない。
  quiescence(k, alpha, beta, qDepth) {
    const standPat = k.teban === SENTE ? k.evaluate() : -k.evaluate();
    if (qDepth >= Sikou.QS_DEPTH_MAX) return standPat;
    if (standPat >= beta) return standPat;
    if (standPat > alpha) alpha = standPat;
    const captures = GenerateMoves.generateCaptureMoves(k);
    Sikou.orderMoves(captures);
    let maxEva = standPat;
    for (let i = 0; i < captures.length; i++) {
      const tempTe = captures[i];
      k.move(tempTe);
      k.teban = k.teban === SENTE ? GOTE : SENTE;
      const tempEva = -this.quiescence(k, -beta, -alpha, qDepth + 1);
      k.back(tempTe);
      k.teban = k.teban === SENTE ? GOTE : SENTE;
      if (tempEva > maxEva) {
        maxEva = tempEva;
        if (maxEva > alpha) alpha = maxEva;
        if (tempEva >= beta) break;
      }
    }
    return maxEva;
  }
}
Sikou.INFINITE = 99999;
// 静止探索で、探索限界からさらに読み進める最大の深さ
Sikou.QS_DEPTH_MAX = 6;
// この値以上（以下）の評価値は、詰みを表すものとして扱う
Sikou.MATE_BOUND = Sikou.INFINITE - 100;
// 省略された項目に使われる既定値
Sikou.DEFAULT_CONFIG = {
  depth: 4,
  josekiMaxTe: 0,
  tsumeDepth: 0,
  ttBits: 20,
};
class Position {
  constructor(suji = 0, dan = 0) {
    this.suji = suji;
    this.dan = dan;
  }
  equals(p) {
    return p.suji === this.suji && p.dan === this.dan;
  }
  clone() {
    return new Position(this.suji, this.dan);
  }
  // 現在のPositionから駒の動いた位置を示す新規Positionインスタンスを生成する
  makeMovedPosition(direct) {
    const newPosi = this.clone();
    newPosi.add(direct);
    return newPosi;
  }
  // 位置を動かす
  add(num1, num2) {
    if (num2 === undefined) {
      this.suji += Koma.diffSuji[num1];
      this.dan += Koma.diffDan[num1];
    } else {
      this.suji += num1;
      this.dan += num2;
    }
  }
  // 逆方向への動き
  sub(num1, num2) {
    if (num2 === undefined) {
      this.suji -= Koma.diffSuji[num1];
      this.dan -= Koma.diffDan[num1];
    } else {
      this.suji -= num1;
      this.dan -= num2;
    }
  }
  // 絶対座標で設定
  change(suji, dan) {
    this.suji = suji;
    this.dan = dan;
  }
}
class Te {
  constructor(koma, from, to, promote, capture) {
    this.koma = koma;
    this.from = from;
    this.to = to;
    this.promote = promote;
    this.capture = capture;
  }
  equals(te) {
    return (
      te.koma === this.koma &&
      te.from.suji === this.from.suji &&
      te.from.dan === this.from.dan &&
      te.to.suji === this.to.suji &&
      te.to.dan === this.to.dan &&
      te.promote === this.promote
    );
  }
  // 引数としてTeの配列を受け取り、その配列に自身が含まれるかチェック
  contains(list) {
    for (let i = 0; i < list.length; i++) {
      if (this.equals(list[i])) return true;
    }
    return false;
  }
  clone() {
    return new Te(this.koma, this.from, this.to, this.promote, this.capture);
  }
  // 手の文字列化
  toString() {
    return (
      sujiStr[this.to.suji] +
      danStr[this.to.dan] +
      Koma.toString(this.koma) +
      (this.promote ? '成' : '') +
      (this.from.suji === 0 ? '打    ' : `(${sujiStr[this.from.suji] + danStr[this.from.dan]})`) +
      (this.promote ? '' : '  ')
    );
  }
}
/* 置換表。局面ハッシュをキーに、その局面で行った探索の結果を保持する。
   同じ局面に別の手順で再び行き着いたとき（transposition）や、
   前の手番で読んだ局面に再び出会ったときに、探索結果を再利用するためのもの。

   エントリ数は2の累乗（1 << bits）個。局面ハッシュの下位bitsで格納位置を決め、
   同じ位置に別の局面が来た場合は、置き換え方針（storeを参照）に従う。
   速度とメモリ効率のため、エントリの各項目は型付き配列に分けて持つ。 */
class TranspositionTable {
  constructor(bits) {
    this.generation = 0;
    // probeで見つかったエントリの内容の受け渡し用。
    // 探索中に何度も呼ばれるため、オブジェクトを都度生成せずプロパティに入れて返す。
    this.hitScore = 0;
    this.hitDepth = 0;
    this.hitFlag = 0;
    this.hitMove = 0;
    const size = 1 << bits;
    this.mask = size - 1;
    this.keyHi = new Int32Array(size);
    this.keyLo = new Int32Array(size);
    this.scores = new Float64Array(size);
    this.depths = new Int8Array(size);
    this.flags = new Uint8Array(size);
    this.ages = new Uint8Array(size);
    this.moves = new Int32Array(size);
  }
  // 新しい探索（一手ごと）の開始時に呼ぶ。
  // 前の探索で書き込んだエントリは、古いものとして上書きされやすくなる。
  newGeneration() {
    this.generation = (this.generation + 1) & 0xff;
  }
  // 全エントリを消去する
  clear() {
    this.flags.fill(0);
    this.generation = 0;
  }
  // 局面のキーでエントリを探す。見つかればtrueを返し、hit〜プロパティに内容を入れる。
  probe(hi, lo) {
    const idx = lo & this.mask;
    if (this.flags[idx] !== 0 && this.keyHi[idx] === hi && this.keyLo[idx] === lo) {
      this.hitScore = this.scores[idx];
      this.hitDepth = this.depths[idx];
      this.hitFlag = this.flags[idx];
      this.hitMove = this.moves[idx];
      return true;
    }
    return false;
  }
  // エントリを書き込む。
  // 置き換え方針：同じ世代（今回の探索）で書き込まれた、より深く読んだ結果は残す。
  // それ以外（空き、前の世代、同じ深さ以上の結果）は上書きする。
  store(hi, lo, depth, score, flag, move) {
    const idx = lo & this.mask;
    if (this.flags[idx] !== 0 && this.ages[idx] === this.generation && this.depths[idx] > depth) {
      return;
    }
    this.keyHi[idx] = hi;
    this.keyLo[idx] = lo;
    this.scores[idx] = score;
    this.depths[idx] = depth > 127 ? 127 : depth;
    this.flags[idx] = flag;
    this.ages[idx] = this.generation;
    this.moves[idx] = move;
  }
  // 手を整数に圧縮する（局面ごとの最善手の保存用）。手が無い場合の0とは区別できる。
  // 駒（6bit）、移動元の筋と段（各4bit）、移動先の筋と段（各4bit）、成り（1bit）。
  static packMove(te) {
    return (
      te.koma |
      (te.from.suji << 6) |
      (te.from.dan << 10) |
      (te.to.suji << 14) |
      (te.to.dan << 18) |
      ((te.promote ? 1 : 0) << 22)
    );
  }
}
// 評価値の種類
TranspositionTable.EXACT = 1; // 正確な評価値
TranspositionTable.LOWER = 2; // 評価値は下限（βカットが起き、これ以上の可能性がある）
TranspositionTable.UPPER = 3; // 評価値は上限（αを超える手がなく、これ以下の可能性がある）
/* 局面ハッシュ（Zobrist hash）用の乱数表。
   局面を表す64bitのキーを、32bitずつ二つ（Hi/Lo）に分けて扱う。
   JavaScriptのnumberは64bitの整数ビット演算ができず、BigIntは遅いため。
   乱数は固定の種から生成するので、実行のたびに値が変わることはない
   （ハッシュ値を保存して後から使う場合も、同じ値が得られる）。 */
class Zobrist {
  // 乱数の生成（mulberry32）。
  // xorshift系の乱数はビット演算に対して線形で、キー同士のXORに規則性が残りやすいため、
  // 乗算を含む非線形の乱数を用いる。
  // zeroEveryが1以上の場合、その個数ごとの先頭（添字がzeroEveryの倍数）のキーを0にする。
  static makeKeys(count, seed, zeroEvery) {
    const keys = new Int32Array(count);
    let a = seed | 0;
    for (let i = 0; i < count; i++) {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      keys[i] = (t ^ (t >>> 14)) | 0;
      if (zeroEvery > 0 && i % zeroEvery === 0) keys[i] = 0;
    }
    return keys;
  }
}
// 持駒の枚数の上限+1（最も多い歩でも18枚なので、枚数は0～18）
Zobrist.HAND_MAX = 19;
// 盤上の升の数
Zobrist.SQUARES = 81;
// 駒コードの種類数（先手後手や成りのフラグを含めた0x00～0x3F）
Zobrist.KOMA_KINDS = 64;
// 盤上の駒用。添字は「駒コード × 81 + 升の番号」。升の番号は (筋-1)*9 + (段-1)。
Zobrist.boardHi = Zobrist.makeKeys(Zobrist.KOMA_KINDS * Zobrist.SQUARES, 0x1badc0de, 0);
Zobrist.boardLo = Zobrist.makeKeys(Zobrist.KOMA_KINDS * Zobrist.SQUARES, 0x2f6e2b1d, 0);
// 持駒用。添字は「(先手後手 × 8 + 駒種) × HAND_MAX + 枚数」。
// 枚数0のキーは0とする（持っていない駒は、ハッシュに何も寄与しない）。
Zobrist.handHi = Zobrist.makeKeys(2 * 8 * Zobrist.HAND_MAX, 0x3c6ef372, Zobrist.HAND_MAX);
Zobrist.handLo = Zobrist.makeKeys(2 * 8 * Zobrist.HAND_MAX, 0x4a7484aa, Zobrist.HAND_MAX);
// 後手番のときだけ加えるキー
Zobrist.tebanHi = Zobrist.makeKeys(1, 0x5cb0a9dc, 0)[0];
Zobrist.tebanLo = Zobrist.makeKeys(1, 0x6dc7e0b3, 0)[0];

Main.main();
