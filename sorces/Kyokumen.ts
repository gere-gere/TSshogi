class Kyokumen {
  ban: number[][];
  hand: number[][];  //先手後手の持駒の配列が入る
  teban: number = SENTE;

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
    let koma: number = te.koma;
    // 移動先に駒があったら持駒にする
    const targetKoma: number = this.getKomaData(te.to);
    if (targetKoma !== Koma.EMPTY) {
      const planeKoma: number = targetKoma & 0x07;  // 成フラグや先手後手フラグをクリア
      if (Koma.isSente(targetKoma)) {
        this.hand[1][planeKoma]++;
      } else {
        this.hand[0][planeKoma]++;
      }
    }

    // 持駒を打つ手だった場合はその持駒を減らす
    if (te.from.suji === 0) {
      const planeKoma: number = koma & 0x07;
      if (Koma.isSente(koma)) {
        this.hand[0][planeKoma]--;
      } else {
        this.hand[1][planeKoma]--;
      }
    } else {  //盤上の駒だった場合は元の位置をEMPTYに
      this.putKoma(te.from, Koma.EMPTY);
    }

    // 駒を移動先に進める
    if (te.promote) koma = koma | Koma.PROMOTE;
    this.putKoma(te.to, koma);
  }

  // 玉の位置を得る
  searchGyoku(teban: number): Position {
    const targetGyoku: number = teban | Koma.OU;
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
      for (let suji: number = 9; suji <= 1; suji--) {
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

}