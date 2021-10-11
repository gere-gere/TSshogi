/* 駒に関する処理を担う静的クラス
 参考書籍ではKomaとKomaMovesを分けていたが、
 本実装では駒に関するものは全てこのクラスに集約する */
class Koma {
  // 駒の基本形
  static readonly EMPTY: number = 0;
  static readonly PROMOTE: number = 8;  //成りフラグ
  static readonly FU: number = 1;
  static readonly KYO: number = 2;
  static readonly KEI: number = 3;
  static readonly GIN: number = 4;
  static readonly KIN: number = 5;
  static readonly KAK: number = 6;
  static readonly HI: number = 7;
  static readonly OU: number = 8;

  // 成り駒
  static readonly TO: number = Koma.FU + Koma.PROMOTE;
  static readonly NY: number = Koma.KYO + Koma.PROMOTE;
  static readonly NK: number = Koma.KEI + Koma.PROMOTE;
  static readonly NG: number = Koma.GIN + Koma.PROMOTE;
  static readonly UMA: number = Koma.KAK + Koma.PROMOTE;
  static readonly RYU: number = Koma.HI + Koma.PROMOTE;

  // 先手の駒
  static readonly SFU: number = SENTE + Koma.FU;
  static readonly SKY: number = SENTE + Koma.KYO;
  static readonly SKE: number = SENTE + Koma.KEI;
  static readonly SGI: number = SENTE + Koma.GIN;
  static readonly SKI: number = SENTE + Koma.KIN;
  static readonly SKA: number = SENTE + Koma.KAK;
  static readonly SHI: number = SENTE + Koma.HI;
  static readonly SOU: number = SENTE + Koma.OU;
  static readonly STO: number = SENTE + Koma.TO;
  static readonly SNY: number = SENTE + Koma.NY;
  static readonly SNK: number = SENTE + Koma.NK;
  static readonly SNG: number = SENTE + Koma.NG;
  static readonly SUM: number = SENTE + Koma.UMA;
  static readonly SRY: number = SENTE + Koma.RYU;

  // 後手の駒
  static readonly GFU: number = GOTE + Koma.FU;
  static readonly GKY: number = GOTE + Koma.KYO;
  static readonly GKE: number = GOTE + Koma.KEI;
  static readonly GGI: number = GOTE + Koma.GIN;
  static readonly GKI: number = GOTE + Koma.KIN;
  static readonly GKA: number = GOTE + Koma.KAK;
  static readonly GHI: number = GOTE + Koma.HI;
  static readonly GOU: number = GOTE + Koma.OU;
  static readonly GTO: number = GOTE + Koma.TO;
  static readonly GNY: number = GOTE + Koma.NY;
  static readonly GNK: number = GOTE + Koma.NK;
  static readonly GNG: number = GOTE + Koma.NG;
  static readonly GUM: number = GOTE + Koma.UMA;
  static readonly GRY: number = GOTE + Koma.RYU;

  // 盤外の壁
  static readonly WALL: number = 0x40;

  static isSente(koma: number): boolean {
    return (koma & SENTE) !== 0;
  }

  static isGote(koma: number): boolean {
    return (koma & GOTE) !== 0;
  }

  static isSelf(teban: number, koma: number) {
    return teban === SENTE ? this.isSente(koma) : this.isGote(koma);
  }

  static isEnemy(teban: number, koma: number) {
    return teban === SENTE ? this.isGote(koma) : this.isSente(koma);
  }

  static getKomashu(koma: number) {
    return koma & 0x0f;
  }

  /*　成り判定用のSetをcanPromoteメソッド呼び出しの度に生成するのは
  不要な負荷が起こるので、クラス内で事前に一度だけ作っておく */
  private static readonly _PROMOTABLE = new Set([Koma.SFU, Koma.SKY, Koma.SKE,
  Koma.SGI, Koma.SKA, Koma.SHI, Koma.GFU, Koma.GKY, Koma.GKE, Koma.GGI,
  Koma.GKA, Koma.GHI]);

  static canPromote(koma: number) {
    if (this._PROMOTABLE.has(koma)) return true;
    return false;
  }

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

  static diffDan: number[] = [
    -1, -1, -1, 0, 0, 1, 1, 1, -2, -2, 2, 2
  ];

  static diffSuji: number[] = [
    1, 0, -1, 1, -1, 1, 0, -1, 1, -1, 1, -1
  ];

  static canMove(koma: number, move: number): boolean {
    // 駒種が不正なら即リターン
    const komasyu: number = this.getKomashu(koma);
    if (komasyu === 0 || komasyu === 13) return false;
    // 先手後手どちらの駒でもなければ即リターン
    const teban: number = koma & 0x30;
    if (teban === 0 || teban === 0x30) return false;
    // 後手の駒の場合は先手側に向きを揃える
    if (teban === GOTE) {
      if (move <= 7) move = 7 - move;
      if (move >= 8) move = 19 - move;
    }
    return this.moveData[komasyu][move];
  }

  // 駒の文字列化…盤面用（後手の頭に'v'が付くなど）
  static toBanString(koma: number): string {
    if (koma === Koma.EMPTY) return '   ';
    // 先手の駒には頭に半角スペース、後手には'v'を追加
    const prefix = (koma & SENTE) !== 0 ? ' ' : 'v';
    return prefix + this.toString(koma);
  }

  // 駒の文字列化…持駒、手用
  static toString(koma: number): string {
    return this.komaString[Koma.getKomashu(koma)];
  }

  // 駒の文字列化用テーブル
  private static readonly komaString: string[] = [
    '  ', '歩', '香', '桂', '銀', '金', '角', '飛',
    '王', 'と', '杏', '圭', '全', '', '馬', '竜'
  ]


  /* 駒が移動可能かどうかのデータ配列
   インデックスは駒種、移動の順の二次元テーブルであり、
   先手向きのみ用意している */
  private static moveData: boolean[][] = [
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

  // 香、角、飛、馬、竜など、一度に複数マスを移動できるかを判定する
  static canJump(koma: number, jump: number): boolean {
    // 駒種が香、角、飛、馬、竜でなければ即リターン
    const komasyu: number = this.getKomashu(koma);
    if (!(komasyu === 2 || komasyu === 6 || komasyu === 7 || komasyu === 14 || komasyu === 15)) return false;
    // 先手後手どちらの駒でもなければ即リターン
    const teban: number = koma & 0x30;
    if (teban === 0 || teban === 0x30) return false;
    // 後手の駒の場合は先手側に向きを揃える
    if (teban === GOTE) jump = 7 - jump;
    return this.jumpData[komasyu][jump];
  }

  private static jumpData: boolean[][] = [
    // EMPTY、歩（インデックス揃え）
    [], [],
    // 香
    [false, true, false, false, false, false, false, false],
    // 桂、銀、金（インデックス揃え）
    [], [], [],
    // 角
    [true, false, true, false, false, true, false, true],
    // 飛
    [false, true, false, true, true, false, true, false],
    // 王、と金、成香、成桂、成銀、成金（欠番）（インデックス揃え）
    [], [], [], [], [], [],
    // 馬
    [true, false, true, false, false, true, false, true],
    //　竜
    [false, true, false, true, true, false, true, false]
  ];
}
