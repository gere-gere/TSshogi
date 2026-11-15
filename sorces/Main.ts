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

  // 局面履歴と同じ並びで、その局面の手番側が王手されているかを記録する。
  // （Kyokumen.cloneは玉の位置を複製しないため、履歴の局面からは王手判定ができない。
  // そのため、局面を履歴に積む時点で判定して保持している）
  // 連続王手の千日手の判定に使う。
  static checkHistory: boolean[] = [];

  // 千日手の判定結果
  static readonly SENNICHITE_NONE: number = 0;        // 千日手ではない
  static readonly SENNICHITE_DRAW: number = 1;        // 通常の千日手（引き分け）
  static readonly SENNICHITE_SENTE_LOSE: number = 2;  // 先手の連続王手の千日手（先手の反則負け）
  static readonly SENNICHITE_GOTE_LOSE: number = 3;   // 後手の連続王手の千日手（後手の反則負け）

  /* 千日手の判定。履歴の末尾を現在の局面として判定する。
    同一局面（手番、盤面、持駒が同じ）が４回目の出現となったら千日手。
    その場合、最初の出現から現在までの区間で、一方だけが全ての手で
    王手をかけ続けていたなら、連続王手の千日手としてその側の反則負けとする。
    双方が王手をかけ続けていた場合、またはどちらも王手をかけ続けていない場合は、
    通常の千日手（引き分け）とする。 */
  static judgeSennichite(history: Kyokumen[], checkHistory: boolean[]): number {
    const current: number = history.length - 1;
    const k: Kyokumen = history[current];
    // 局面ハッシュ（手番を含む）が一致した場合だけ、念のため全盤面を比較して確定させる。
    // （盤面の比較は、ハッシュが一致したときしか行われないため、ほぼ負荷にならない）
    const hi: number = k.keyHi();
    const lo: number = k.keyLo();
    // 現在の局面と同一の局面が、履歴の何番目にあるか
    const sameIdx: number[] = [];
    for(let i: number = 0; i < history.length; i++) {
      const kyokumen: Kyokumen = history[i];
      if(kyokumen.keyHi() === hi && kyokumen.keyLo() === lo && k.equals(kyokumen)) sameIdx.push(i);
    }
    if(sameIdx.length < 4) return Main.SENNICHITE_NONE;

    // 最初の出現から現在の手前までの各局面について、手番側が王手されているかを調べる。
    // 先手番の局面が全て王手されている＝後手が全ての手で王手をかけ続けている。
    // 後手番の局面が全て王手されている＝先手が全ての手で王手をかけ続けている。
    let senteChecking: boolean = true;
    let goteChecking: boolean = true;
    for(let n: number = sameIdx[0]; n < current; n++) {
      if(history[n].teban === SENTE) {
        if(!checkHistory[n]) goteChecking = false;
      } else {
        if(!checkHistory[n]) senteChecking = false;
      }
    }
    if(senteChecking && !goteChecking) return Main.SENNICHITE_SENTE_LOSE;
    if(goteChecking && !senteChecking) return Main.SENNICHITE_GOTE_LOSE;
    return Main.SENNICHITE_DRAW;
  }

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
    while(true) {
      // 現在の局面を履歴に残す
      this.kyokumenHistory.push(k.clone());
      // その局面の手番側が王手されているかも同時に記録する
      this.checkHistory.push(GenerateMoves.isGyokuAttacked(k, k.teban));

      // 現在の局面での合法手を生成
      const legalTe: Te[] = GenerateMoves.generateLegalMoves(k);
      // 合法手が一つもない＝詰み
      if(legalTe.length === 0) {
        console.log(k.teban === SENTE ? '後手の勝ち\n' : '先手の勝ち\n');
        break;
      }

      // 千日手チェック。連続王手の千日手は、王手をかけ続けた側の反則負けとする。
      const sennichite: number = this.judgeSennichite(this.kyokumenHistory, this.checkHistory);
      if(sennichite === Main.SENNICHITE_DRAW) {
        console.log('【 千日手 】\n');
        break;
      }
      if(sennichite === Main.SENNICHITE_SENTE_LOSE) {
        console.log('【 連続王手の千日手 】\n先手の反則負け\n後手の勝ち\n');
        break;
      }
      if(sennichite === Main.SENNICHITE_GOTE_LOSE) {
        console.log('【 連続王手の千日手 】\n後手の反則負け\n先手の勝ち\n');
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