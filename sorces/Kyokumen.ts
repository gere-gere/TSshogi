class Kyokumen {
  ban: number[][];
  hand: number[][];  //先手後手の持駒の配列が入る
  teban: number = SENTE;
  // 玉の位置をプロパティとして保持する。初期値は絶対に利きの届かない盤外。
  kingS: Position = new Position(-2, -2);
  kingG: Position = new Position(-2, -2);

  constructor() {
    this.ban = Array(11);
    for (let i = 0; i < 11; i++) {
      this.ban[i] = new Array(11).fill(0);
    }
    this.hand = Array(2);
    // インデックス1から順に歩、香、桂・・・飛を意味し、その枚数が格納される
    // インデックス0（EMPTY）は欠番であり、未使用
    this.hand[0] = Array(8).fill(0);  //先手の持駒
    this.hand[1] = Array(8).fill(0);  //後手の持駒
  }

  clone(): Kyokumen {
    const k: Kyokumen = new Kyokumen();
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

  equals(k: Kyokumen): boolean {
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
  getKomaData(p: Position): number {
    if (p.suji < 1 || p.suji > 9 || p.dan < 1 || p.dan > 9) return Koma.WALL;
    return this.ban[p.suji][p.dan];
  }

  // 指定位置に駒を置く
  putKoma(p: Position, koma: number): void {
    this.ban[p.suji][p.dan] = koma;
  }

  // 与えられた手で一手すすめてみる
  // 自身の駒を取るような手は渡されないことが保証されている
  //（このメソッド内ではその判定はしない）
  move(te: Te): void {
    // 駒を取る手であればその駒を持駒にする
    if (te.capture !== Koma.EMPTY) {
      const koma: number = te.capture & 0x07;  // 成フラグや先手後手フラグをクリア
      if (Koma.isSente(te.capture)) {
        this.hand[1][koma]++;
      } else {
        this.hand[0][koma]++;
      }
    }

    // 持駒を打つ手だった場合はその持駒を減らす
    if (te.from.suji === 0) {
      const koma: number = te.koma & 0x07;
      if (Koma.isSente(te.koma)) {
        this.hand[0][koma]--;
      } else {
        this.hand[1][koma]--;
      }
    } else {  //盤上の駒だった場合は元の位置をEMPTYに
      this.putKoma(te.from, Koma.EMPTY);
    }

    // 駒を移動先に進める
    const koma = te.promote ? te.koma | Koma.PROMOTE : te.koma;
    this.putKoma(te.to, koma);

    // 玉の位置を更新
    if(te.koma === Koma.SOU) {
      this.kingS = te.to;
    } else if(te.koma === Koma.GOU) {
      this.kingG = te.to;
    }
  }

  // 手を一手巻き戻す（moveの逆）
  back(te: Te): void {
    // 取った駒を元に戻す（取ってないならEMPTYに戻す）
    this.putKoma(te.to, te.capture);

    // 取った駒があった場合、戻した持駒を減らす
    if(te.capture !== Koma.EMPTY) {
      const koma: number = te.capture & 0x07;
      // 持駒を減らす
      if(Koma.isSente(te.capture)) {
        this.hand[1][koma]--;
      } else {
        this.hand[0][koma]--;
      }
    }

    // 打ち駒だった場合、持駒に戻す
    if(te.from.suji === 0) {
      const koma: number = te.koma & 0x07;
      if(Koma.isSente(te.koma)) {
        this.hand[0][koma]++;
      } else {
        this.hand[1][koma]++;
      }
    // 打駒でなかった場合、元の位置に戻す
    } else {
      this.putKoma(te.from, te.koma);
    }

    // 玉であった場合は玉の位置情報を戻す
    if(te.koma === Koma.SOU) {
      this.kingS = te.from;
    } else if(te.koma === Koma.GOU) {
      this.kingG = te.from;
    }
  }

  // 玉の位置を再探索し設定
  researchGyoku(): void {
    this.kingS.change(-2, -2);
    this.kingG.change(-2, -2);
    for (let suji = 1; suji <= 9; suji++) {
      for (let dan = 1; dan <= 9; dan++) {
        if (this.ban[suji][dan] === Koma.SOU) {
          this.kingS.change(suji, dan);
        } else if(this.ban[suji][dan] === Koma.GOU) {
          this.kingG.change(suji, dan);
        }
      }
    }
  }

  // 玉位置を取得
  searchGyoku(teban: number) {
    return teban === SENTE ? this.kingS : this.kingG;
  }

  // ここよりファイル入出力
  // CSA形式の棋譜ファイル文字列
  static readonly csaKomaTbl: string[] = [
    "   ", "FU", "KY", "KE", "GI", "KI", "KA", "HI",
    "OU", "TO", "NY", "NK ", "NG", "", "UM", "RY",
    "", "+FU", "+KY", "+KE", "+GI", "+KI", "+KA", "+HI",
    "+OU", "+TO", "+NY", "+NK", "+NG", "", "+UM", "+RY",
    "", "-FU", "-KY", "-KE", "-GI", "-KI", "-KA", "-HI",
    "-OU", "-TO", "-NY", "-NK", "-NG", "", "-UM", "-RY"
  ];

  // 棋譜（文字列の配列へ変換済）を受け取り局面に反映させる
  readCsaKifu(csaKifu: string[]): void {
    // 駒箱に入っている残り駒
    const restKoma: number[] = Array(8).fill(0);
    // 最初は玉以外全部、駒箱に入ってる
    restKoma[Koma.FU] = 18;
    restKoma[Koma.KYO] = 4;
    restKoma[Koma.KEI] = 4;
    restKoma[Koma.GIN] = 4;
    restKoma[Koma.KIN] = 4;
    restKoma[Koma.KAK] = 2;
    restKoma[Koma.HI] = 2;

    // 盤面を初期化
    for (let suji: number = 1; suji <= 9; suji++) {
      for (let dan: number = 1; dan <= 9; dan++) {
        this.ban[suji][dan] = Koma.EMPTY;
      }
    }

    // 棋譜読み込みと解析
    // 棋譜構造についてはCSA棋譜形式のプロトコル熟読のこと
    // 現時点では開始局面の生成にのみ対応している
    for (let i: number = 0; i < csaKifu.length; i++) {
      const line: string = csaKifu[i];
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
        for (let koma: number = Koma.FU; koma <= Koma.HI; koma++) {
          restKoma[koma] = 0;
        }
        continue;
      }

      // 余った持駒を一括で一方の持駒とする'P+00AL','P-00AL'、
      // また、駒別単独表現にも対応する
      if (line.startsWith('P+') || line.startsWith('P-')) {
        let flag: number;
        line.startsWith('P+') ? flag = 0 : flag = 1;
        if (line === 'P+00AL' || line === 'P-00AL') {
          // 残りの駒を全てflag側の持駒に移す
          for (let koma: number = Koma.FU; koma <= Koma.HI; koma++) {
            this.hand[flag][koma] = restKoma[koma];
          }
        } else {
          // 棋譜文字列から駒情報を抜き取る
          for (let j: number = 0; j <= line.length - 6; j += 4) {
            const sujiDanStr: string = line.substr(j + 2, 2);
            const komaStr: string = line.substr(j + 4, 2);
            let koma: number = Kyokumen.csaKomaTbl.indexOf(komaStr);
            // 00なら持駒へ
            if (sujiDanStr === '00') {
              this.hand[flag][koma & 0x07]++;
            } else {
              // それ以外は筋と段を解析の上、盤上へ
              const suji: number = parseInt(sujiDanStr.substr(0, 1));
              const dan: number = parseInt(sujiDanStr.substr(1, 1));
              this.ban[suji][dan] = koma | (flag === 0 ? SENTE : GOTE);
            }
            restKoma[koma & 0x07]--;  // 駒箱から減らす
          }
        }
        continue;
      }

      // 一括表現による盤面への駒の配置
      if (line.startsWith('P')) {
        const dan: number = parseInt(line.substr(1, 1));
        if (Number.isNaN(dan)) throw 'dan is not a number.';  // 棋譜に変な値が入っていたら一応エラー投げとく
        for (let suji: number = 1; suji <= 9; suji++) {
          // 将棋の筋は右から始まるので逆に読んでいく
          const komaStr: string = line.substr(2 + (9 - suji) * 3, 3);
          let koma: number = Kyokumen.csaKomaTbl.indexOf(komaStr);
          if (koma === -1) {
            koma = Koma.EMPTY;  // 該当する駒がない＞EMPTY
          } else {
            restKoma[koma & 0x07]--;  // 駒箱から減らす
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
  toString(): string {
    let s: string = '';
    for (let koma: number = Koma.FU; koma <= Koma.HI; koma++) {
      for (let i: number = 0; i < this.hand[1][koma]; i++) {
        s += Koma.toString(koma);
      }
    }
    s += '\n';
    // 盤面表示
    s += '  9   8   7   6   5   4   3   2   1\n';
    s += '+---+---+---+---+---+---+---+---+---+\n';
    for (let dan: number = 1; dan <= 9; dan++) {
      for (let suji: number = 9; suji >= 1; suji--) {
        s += '|';
        s += Koma.toBanString(this.ban[suji][dan]);
      }
      s += '|' + danStr[dan] + '\n';
      s += '+---+---+---+---+---+---+---+---+---+\n';
    }
    for (let koma: number = Koma.FU; koma <= Koma.HI; koma++) {
      for (let i: number = 0; i < this.hand[0][koma]; i++) {
        s += Koma.toString(koma);
      }
    }
    s += '\n';
    return s;
  }

  // 局面評価のための駒の価値
  static komaValue: number[] = [
    0, 100, 290, 370, 480, 580, 900, 1070,   // 先手後手どちらでもない空～飛まで
    10000, 580, 580, 580, 580, 0, 1200, 1400,    // 先手後手どちらでもない王～成駒～竜まで
    0, 100, 290, 370, 480, 580, 900, 1070,    // 無、先手の歩～飛
    10000, 580, 580, 580, 580, 0, 1200, 1400,    // 先手の王～成駒～竜
    0, -100, -290, -370, -480, -580, -900, -1070,   // 無、後手の歩～飛
    -10000, -580, -580, -580, -580, 0, -1200, -1400   // 後手の王～成駒～竜
  ];

  // 局面評価関数。現時点では駒の価値の総和に過ぎないが、
  // 評価方法を発展させる際はここに各基準を追記していく
  evaluate(): number {
    let eva: number = 0;
    // 盤上の駒の価値を全て加算
    for(let suji: number = 1; suji <= 9; suji++) {
      for(let dan: number = 1; dan <= 9; dan++) {
        const koma: number = this.ban[suji][dan];
        // 位置による価値調整用の係数
        let coefficient = 1;
        // 下段の香車に力有り
        if(koma === Koma.SKY) {
          coefficient = 0.91 + dan * 0.01;
        } else if(koma === Koma.GKY) {
          coefficient = 1.01 - dan * 0.01;
        }
        // 桂馬の高跳び歩の餌食
        if(koma === Koma.SKE) {
          coefficient = 0.991 + dan * 0.001;
        } else if(koma === Koma.GKE) {
          coefficient = 1.001 - dan * 0.001;
        }
        eva += Kyokumen.komaValue[koma] * coefficient;
      }
    }
    // 持駒の価値を全て加算
    for(let teban: number = 0; teban < 2; teban++) {
      for(let koma: number = 1; koma < 8; koma++) {
        const sign: number = teban === 0 ? 1 : -1;
        // 歩は枚数が増える毎に価値が目減りする。一枚目（歩切れでない）は少し価値が上がる。
        const coefficient: number = koma !== Koma.FU ? 1 : 1.05 - this.hand[teban][1] * 0.03;
        eva += this.hand[teban][koma] * Kyokumen.komaValue[koma] * coefficient * sign;
      }
    }
    return eva;
  }

}