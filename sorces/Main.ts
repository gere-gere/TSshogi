// モジュール読み込み
const fs = require('fs');

// 起動時に走るMainクラス
class Main {
  private static readonly shokiBanmen: number[][] = [
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
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  ];

  // 起動時に呼び出されるメイン関数
  static main(): void {
    const k: Kyokumen = new Kyokumen();
    if (!process.argv[2]) {
      k.teban = SENTE;
      k.ban = this.shokiBanmen;
    } else {
      const filename: string = process.argv[2];
      let kifu: string[];
      try {
        const kifuStr: string = fs.readFileSync('../kifu' + filename, 'utf-8');
        kifu = kifuStr.split('\n');
      } catch {
        throw '棋譜ファイルを読み込めません。ファイル名を確認してください。';
      }
      k.readCsaKifu(kifu);
    }
    // 局面を一度出力する
    console.log(k.toString());

    // この局面における合法手も表示してみる
    const te: Te[] = GenerateMoves.generateLegalMoves(k);
    let teStr: string = '';
    console.log(`可能手：${te.length}手`);
    for(let i = 0; i < te.length; i++) {
      if(i !== 0) teStr += ', ';
      teStr += te[i].toString();
    }
    console.log(teStr);
  }

}