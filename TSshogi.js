'use strict';
/* グローバル定数*/
// 手番
const SENTE = 0x10;
const GOTE = 0x20;
// 筋を表す文字列の定義
const sujiStr = ['', '１', '２', '３', '４', '５', '６', '７', '８', '９'];
// 段を表す文字列の定義
const danStr = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
// 合法手の候補リストを生成する静的クラス
class GenerateMoves {
  /* 手を指した後に自身の玉に王手がかかっていないか、
      つまり自殺手や王手放置となっていないかをチェックし、取り除く*/
  static removeSelfMate(k, list) {
    const removed = [];
    list.forEach((te) => {
      const test = k.clone();
      test.move(te);
      const gyokuPosition = test.searchGyoku(k.teban);
      // 玉の周辺から相手の駒が利いていたら、手に加えずリターン
      for (let direct = 0; direct <= 11; direct++) {
        const pos = gyokuPosition.clone();
        pos.sub(direct);
        const koma = test.getKomaData(pos);
        if (Koma.isEnemy(test.teban, koma) && Koma.canMove(koma, direct)) return;
      }
      // 玉周りの８方向からの飛び利きがあったらリターン
      for (let direct = 0; direct <= 7; direct++) {
        const pos = gyokuPosition.clone();
        let koma;
        do {
          pos.sub(direct);
          koma = test.getKomaData(pos);
          // 味方駒でさえぎられていたらbreak
          if (Koma.isSelf(test.teban, koma)) break;
          // 相手の駒で、かつその方向に移動可能な飛び駒であれば
          // 王手がかかっていることになるのでリターン
          if (Koma.isEnemy(test.teban, koma) && Koma.canJump(koma, direct)) return;
          // 王手ではない相手の駒でさえぎられていたらbreak
          if (Koma.isEnemy(test.teban, koma)) break;
        } while (koma !== Koma.WALL);
      }
      // 直接の利き、飛び利きのいずれも問題なかったのでリストに加える
      removed.push(te);
    });
    return removed;
  }
  // 与えられた配列"list"に成、不成を考慮して
  // 生成した候補手を追加する
  static addTe(list, teban, koma, from, to) {
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
    if ((Koma.getKomashu(koma) === Koma.FU || Koma.getKomashu(Koma.KYO)) && to.dan === dan) {
      const te = new Te(koma, from, to, true);
      list.push(te);
      return;
    }
    // 二段目以上（後手なら八段目以下）の桂馬は成る
    if (
      Koma.getKomashu(koma) === Koma.KEI &&
      to.dan * fluctuation <= (dan + fluctuation) * fluctuation
    ) {
      const te = new Te(koma, from, to, true);
      list.push(te);
      return;
    }
    // 三段目以上(後手なら七段目以下)で、成れる駒は
    // 成と不成の両方を生成して追加
    if (
      to.dan * fluctuation <= (dan + fluctuation * 2) * fluctuation ||
      (from.dan * fluctuation <= (dan + fluctuation * 2) * fluctuation && Koma.canPromote(koma))
    ) {
      const te = new Te(koma, from, to, false);
      list.push(te);
      const tePromote = new Te(koma, from, to, true);
      list.push(tePromote);
      return;
    }
    // どれにも該当しない場合は不成のみ生成
    const te = new Te(koma, from, to, false);
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
    const test = k.clone();
    test.move(te);
    test.teban = tebanEnemy;
    const list = this.generateLegalMoves(test);
    return list.length === 0 ? true : false;
  }
  // 与えられた局面における合法手を生成する
  static generateLegalMoves(k) {
    const list = [];
    // 盤上の駒を動かす手を生成
    for (let suji = 1; suji <= 9; suji++) {
      for (let dan = 1; dan <= 9; dan++) {
        const from = new Position(suji, dan);
        const koma = k.getKomaData(from);
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
    const hand = k.teban === 0x10 ? k.hand[0] : k.hand[1];
    // 持駒を歩から飛まで順にチェックする
    for (let koma = Koma.FU; koma <= Koma.HI; koma++) {
      // 該当する駒が持駒になければcontinue
      if (hand[koma] === 0) continue;
      // 盤面を順にチェック
      for (let suji = 1; suji <= 9; suji++) {
        // 駒が歩の場合は二歩チェック
        if (koma === Koma.FU && this.isNifu(k, suji)) continue;
        for (let dan = 1; dan <= 9; dan++) {
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
          const from = new Position(0, 0);
          const to = new Position(suji, dan);
          // 空きでないと駒は打てない
          if (k.getKomaData(to) !== Koma.EMPTY) continue;
          // ようやく手の生成
          const te = new Te(k.teban | koma, from, to, false);
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
  static generateOneKomaMoves(list, k, koma, from) {
    for (let direct = 0; direct <= 11; direct++) {
      if (Koma.canMove(koma, direct)) {
        const to = from.makeMovedPosition(direct);
        // 移動先は盤内か
        if (to.suji >= 1 && to.suji <= 9 && to.dan >= 1 && to.dan <= 9) {
          // 自分の駒でふさがってないか
          if (Koma.isSelf(k.teban, k.getKomaData(to))) continue;
          // 駒を動かせる。成、不成を考慮しつつ手に追加。
          this.addTe(list, k.teban, koma, from, to);
        }
      }
    }
  }
  // 盤上の特定の駒一つ分の動き、飛び駒用
  static generateOneKomaJumps(list, k, koma, from) {
    for (let direct = 0; direct <= 7; direct++) {
      if (Koma.canJump(koma, direct)) {
        // 飛び方向に一マスずつ動かしていく
        // ただし１歩目はOneKomaMovesと被るので手を生成しない
        for (let i = 1; i < 9; i++) {
          let to = from.clone();
          for (let j = 0; j < i; j++) {
            to.add(direct);
          }
          // 盤の範囲を超えていればbreak
          if (to.suji < 1 || to.suji > 9 || to.dan < 1 || to.dan > 9) break;
          // 自分の駒でふさがっている場合もbreak
          if (Koma.isSelf(k.teban, k.getKomaData(to))) break;
          // 相手の駒がある場合、１歩目ならbreak、２歩目以降なら手を生成した上でbreak
          if (Koma.isEnemy(k.teban, k.getKomaData(to))) {
            if (i !== 1) {
              this.addTe(list, k.teban, koma, from, to);
            }
            break;
          }
          // 盤内かつ空きだった。１歩目の場合はOneKomaMovesと被るので生成せずにcontinue
          if (i === 1) continue;
          // 盤内かつ空きであり、２歩目以降だった。手を生成して次の一歩へ
          this.addTe(list, k.teban, koma, from, to);
        }
      }
    }
  }
  // 二歩チェック
  static isNifu(k, suji) {
    for (let dan = 1; dan <= 9; dan++) {
      if (k.getKomaData({ suji, dan }) === (k.teban | Koma.FU)) return true;
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
    if (this._PROMOTABLE.has(koma)) return true;
    return false;
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
    return k;
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
    if (p.suji < 1 || p.suji > 9 || p.dan < 1 || p.dan > 9) return Koma.WALL;
    return this.ban[p.suji][p.dan];
  }
  // 指定位置に駒を置く
  putKoma(p, koma) {
    this.ban[p.suji][p.dan] = koma;
  }
  // 与えられた手で一手すすめてみる
  // 自身の駒を取るような手は渡されないことが保証されている
  //（このメソッド内ではその判定はしない）
  move(te) {
    let koma = te.koma;
    // 移動先に駒があったら持駒にする
    const targetKoma = this.getKomaData(te.to);
    if (targetKoma !== Koma.EMPTY) {
      const planeKoma = targetKoma & 0x07; // 成フラグや先手後手フラグをクリア
      if (Koma.isSente(targetKoma)) {
        this.hand[1][planeKoma]++;
      } else {
        this.hand[0][planeKoma]++;
      }
    }
    // 持駒を打つ手だった場合はその持駒を減らす
    if (te.from.suji === 0) {
      const planeKoma = koma & 0x07;
      if (Koma.isSente(koma)) {
        this.hand[0][planeKoma]--;
      } else {
        this.hand[1][planeKoma]--;
      }
    } else {
      //盤上の駒だった場合は元の位置をEMPTYに
      this.putKoma(te.from, Koma.EMPTY);
    }
    // 駒を移動先に進める
    if (te.promote) koma = koma | Koma.PROMOTE;
    this.putKoma(te.to, koma);
  }
  // 玉の位置を得る
  searchGyoku(teban) {
    const targetGyoku = teban | Koma.OU;
    for (let suji = 1; suji <= 9; suji++) {
      for (let dan = 1; dan <= 9; dan++) {
        if (this.ban[suji][dan] === targetGyoku) {
          return new Position(suji, dan);
        }
      }
    }
    // 見つからずにループを終えた場合はダミーとして盤外を返す
    return new Position(-2, -2);
  }
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
// モジュール読み込み
const fs = require('fs');
// 起動時に走るMainクラス
class Main {
  // 起動時に呼び出されるメイン関数
  static main() {
    const k = new Kyokumen();
    if (!process.argv[2]) {
      k.teban = SENTE;
      k.ban = this.shokiBanmen;
    } else {
      const filename = process.argv[2];
      let kifu;
      try {
        const kifuStr = fs.readFileSync('../kifu' + filename, 'utf-8');
        kifu = kifuStr.split('\n');
      } catch {
        throw '棋譜ファイルを読み込めません。ファイル名を確認してください。';
      }
      k.readCsaKifu(kifu);
    }
    // 局面を一度出力する
    console.log(k.toString());
    // この局面における合法手も表示してみる
    const te = GenerateMoves.generateLegalMoves(k);
    let teStr = '';
    console.log(`可能手：${te.length}手`);
    for (let i = 0; i < te.length; i++) {
      if (i !== 0) teStr += ', ';
      teStr += te[i].toString();
    }
    console.log(teStr);
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
      this.add(Koma.diffSuji[num1], Koma.diffDan[num1]);
    } else {
      this.suji += num1;
      this.dan += num2;
    }
  }
  // 逆方向への動き
  sub(num1, num2) {
    if (num2 === undefined) {
      this.sub(Koma.diffSuji[num1], Koma.diffDan[num1]);
    } else {
      this.suji -= num1;
      this.dan -= num2;
    }
  }
}
class Te {
  constructor(koma, from, to, promote) {
    this.koma = koma;
    this.from = from;
    this.to = to;
    this.promote = promote;
  }
  equals(te) {
    return (
      te.koma === this.koma &&
      te.from === this.from &&
      te.to === this.to &&
      te.promote === this.promote
    );
  }
  clone() {
    return new Te(this.koma, this.from, this.to, this.promote);
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

Main.main();
