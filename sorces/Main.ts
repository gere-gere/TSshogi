// 起動時に走るMainクラス。静的。
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

  // プレイヤー情報（AIかHumanか）
  static player: Player[] = [];

  // 局面履歴
  static kyokumenHistory: Kyokumen[] = [];

  // 起動時に呼び出されるメイン関数
  // 引数としてPlyer情報を受け取る
  static main(sente?: string, gote?: string): void {
    // プレイヤー情報の処理。senteだけ受け取りgoteが省略された場合は
    // goteはAIとする。両方とも省略されている場合は
    // sente：Human、gote：AIとする。
    if(!sente && !gote) {
      this.player[0] = new Human();
      this.player[1] = new Sikou();
    } else if(sente && !gote) {
      this.player[0] = sente.toUpperCase() === 'HUMAN' ? new Human() : new Sikou();
      this.player[1] = new Sikou();
    } else {
      this.player[0] = sente?.toUpperCase() === 'HUMAN' ? new Human() : new Sikou();
      this.player[1] = gote?.toUpperCase() === 'HUMAN' ? new Human() : new Sikou();
    }

    const k: Kyokumen = new Kyokumen();
    if (!process.argv[2]) {
      k.teban = SENTE;
      k.ban = this.shokiBanmen;
    } else {
      const filename: string = process.argv[2];
      let kifu: string[];
      const kifuStr: string = fs.readFileSync('../kifu/' + filename, 'utf-8');
      kifu = kifuStr.split('\n');
      k.readCsaKifu(kifu);
    }
    // 玉位置情報をセット
    k.researchGyoku();


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
    while(true) {
      // 現在の局面を履歴に残す
      this.kyokumenHistory.push(k.clone());

      // 現在の局面での合法手を生成
      const legalTe: Te[] = GenerateMoves.generateLegalMoves(k);
      // 合法手が一つもない＝詰み
      if(legalTe.length === 0) {
        console.log(k.teban === SENTE ? '後手の勝ち\n' : '先手の勝ち\n');
        break;
      }

      // 千日手チェック。連続王手の千日手には未対応。
      let sameKyokumen: number = 0;
      this.kyokumenHistory.forEach(kyokumen => {
        if(k.equals(kyokumen)) sameKyokumen++;
      });
      if(sameKyokumen >= 4) {
        console.log('【 千日手 】\n');
        break;
      }

      // 局面表示
      console.log(k.toString());

      let nextTe: Te = k.teban === SENTE ? this.player[0].getNextTe(k) : this.player[1].getNextTe(k);
      // 指し手を表示
      console.log(nextTe.toString());

      // 指し手が合法手に含まれない場合は反則負け
      // 入力として合法手以外を受け付けないようにする処理は
      // UI側で対応することとする（現状、非対応）
      // 投了も不完全な対応（反則負け扱いとなる）
      if(!nextTe.contains(legalTe)) {
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