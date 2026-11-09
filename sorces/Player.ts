interface Player {
  getNextTe(k: Kyokumen): Te;
}

/* 入力ルール
  1）盤上の駒を動かす場合、移動元の位置を二桁の数字で
　　続けて移動先の位置を二桁の数字で、合わせて四桁の数字で入力する。
    初手２六歩の場合は「2726」となる。
  2)成る時は末尾に「*」を付ける。
    ２三歩成の場合は「2423*」となる。
    なお、３一歩のような「必ず成るしかない指し手」は
    「*」がなくても成るものとして扱われる。
  3)持駒を打つ際は移動元の代わりに先頭二桁で駒種を表す。
    ３三角打の場合は「0633」となる。
  4)投了の際は「%TORYO」と入力する。
  5)デバッグ用：「p」で合法手一覧を生成
*/

class Human implements Player {
  getNextTe(k: Kyokumen): Te {
    // 指し手を格納する変数。投了で初期化済。
    // 正しい入力があれば合法手で書き換えられる。
    const toryoPosi: Position = new Position(0, 0);
    let te = new Te(0, toryoPosi, toryoPosi, false, Koma.EMPTY);

    // まずは合法手の生成
    const legalTe: Te[] = GenerateMoves.generateLegalMoves(k);

    do {
      console.log(k.teban === SENTE ? '先手番です\n' : '後手番です\n');

      // 入力待ち
      let input: string = readlineSync.question('move?: ');
      
      // 入力が投了であれば投了となる手を生成して終了
      if(input.toUpperCase() === '%TORYO') {
        break;
      }
      // コマンドpであれば合法手一覧を出力
      if(input === 'p') {
        let teStr: string = '';
        console.log(`可能手：${legalTe.length}手`);
        for(let i: number = 0; i < legalTe.length; i++) {
          if(i !== 0) teStr += ', ';
          teStr += legalTe[i].toString();
        }
        console.log(teStr);
        continue;
      }

      // 入力内容を解析
      let promote: boolean = false;
      if(input.length === 5) {
        if(input.charAt(4) === '*') {
          promote = true;
        } else {
          console.log('入力内容が不正です（再入力）');
          continue;
        }
      }

      let fromSuji: number = 0, fromDan: number = 0,toSuji: number = 0,toDan: number = 0;
      fromSuji = parseInt(input.charAt(0));
      fromDan = parseInt(input.charAt(1));
      toSuji = parseInt(input.charAt(2));
      toDan = parseInt(input.charAt(3));
      if(Number.isNaN(fromSuji) || Number.isNaN(fromDan) || Number.isNaN(toSuji) || Number.isNaN(toDan)) {
        console.log('入力内容が不正です（再入力）');
        continue;  
      }

      let koma: number = 0;
      // 先頭が0ならば駒打ち
      if(fromSuji === 0) {
        koma = fromDan | k.teban;
        fromDan = 0;
      }
      const from: Position = new Position(fromSuji, fromDan);
      const to: Position = new Position(toSuji, toDan);
      if(fromSuji !== 0) {
        // 駒を打つ手でない場合は駒を取得
        koma = k.getKomaData(from);
        // 不成不可の手（成らないと行き所のない駒になる手）は、
        // 「*」がなくても強制成として扱う
        if(!promote && GenerateMoves.mustPromote(koma, toDan)) {
          promote = true;
        }
      }
      te = new Te(koma, from, to, promote, k.getKomaData(to));
      if(!te.contains(legalTe)) {
        console.log('合法手ではありません（再入力）');
        continue;
      }

      // 全て問題なければループを抜ける
      break;
    } while(true);
    return te;
  }
}

// 思考ルーチンの強さを調整するためのパラメータ
interface SikouConfig {
  // 読み深度（実装済み）
  depth: number;
  // 定跡を使う手数の上限。0なら定跡を使わない（未実装）
  josekiMaxTe: number;
  // 詰将棋ルーチンで読む手数の上限。0なら詰将棋ルーチンを使わない（未実装）
  tsumeDepth: number;
  // 置換表のエントリ数を2の累乗で指定する（20なら約100万エントリ、約20MB）。
  // 0以下なら置換表を使わない。置換表は対局を通して保持される。
  ttBits: number;
}

class Sikou implements Player {
  static readonly INFINITE = 99999;
  // 静止探索で、探索限界からさらに読み進める最大の深さ
  static readonly QS_DEPTH_MAX = 6;
  // この値以上（以下）の評価値は、詰みを表すものとして扱う
  static readonly MATE_BOUND = Sikou.INFINITE - 100;
  // 省略された項目に使われる既定値
  static readonly DEFAULT_CONFIG: SikouConfig = {
    depth: 4,
    josekiMaxTe: 0,
    tsumeDepth: 0,
    ttBits: 20
  };

  private readonly config: SikouConfig;
  // 置換表。使わない設定の場合はnull
  private readonly tt: TranspositionTable | null;

  // 一部の項目だけを指定してもよい。省略した項目はDEFAULT_CONFIGの値となる。
  constructor(config: Partial<SikouConfig> = {}) {
    this.config = { ...Sikou.DEFAULT_CONFIG, ...config };
    this.tt = this.config.ttBits > 0 ? new TranspositionTable(this.config.ttBits) : null;
  }

  // 詰みを表す評価値は「根からの深さ」を含んでいるため、
  // 置換表には「その局面からの詰みまでの手数」の形に直して保存する。
  // （同じ局面でも、根からの深さが違えば評価値の見え方が変わるため）
  static toTTScore(score: number, ply: number): number {
    if(score >= Sikou.MATE_BOUND) return score + ply;
    if(score <= -Sikou.MATE_BOUND) return score - ply;
    return score;
  }

  // 置換表から取り出した評価値を、現在の根からの深さに合わせた値に直す
  static fromTTScore(score: number, ply: number): number {
    if(score >= Sikou.MATE_BOUND) return score - ply;
    if(score <= -Sikou.MATE_BOUND) return score + ply;
    return score;
  }

  getNextTe(k: Kyokumen): Te {
    // 局面ハッシュを念のため計算し直す。（盤面を直接書き換えた場合などに
    // 差分更新の結果とずれていても、探索の起点を正しくするため）
    k.initHash();
    if(this.tt !== null) this.tt.newGeneration();
    // 手を格納する変数。投了で初期化しておく。
    const start: number = Date.now();
    let te: Te = new Te(0, new Position(0, 0), new Position(0, 0), false, Koma.EMPTY);
    const eva = this.negaMax(te, k, -Sikou.INFINITE, Sikou.INFINITE , 0, this.config.depth);
    const end: number = Date.now();
    console.log(`（探索時間：${end - start} ms　評価値：${Math.floor(eva)}）`);
    return te;
  }

  // 入れ物となるteを受け取り、評価が最大となるTeを格納する
  // また、その評価値をreturnする
  // ネガαβ法では常に指し手側を正とし、最大評価を求める
  negaMax(te: Te, k: Kyokumen, alpha: number, beta: number, depth: number, depthMax: number): number {
    // 探索深さが最大に達していたら、駒の取り合いが落ち着くまで
    // 静止探索で読み進めた上で評価を行い、探索終了
    if(depth >= depthMax) {
      return this.quiescence(k, alpha, beta, 0);
    }

    // この局面からの残りの探索深さ
    const remaining: number = depthMax - depth;
    // 置換表を参照する。見つかったエントリの最善手は、手の並べ替えで先頭にする。
    const tt: TranspositionTable | null = this.tt;
    let hi: number = 0;
    let lo: number = 0;
    let ttMove: number = 0;
    if(tt !== null) {
      hi = k.keyHi();
      lo = k.keyLo();
      if(tt.probe(hi, lo)) {
        ttMove = tt.hitMove;
        // 十分深く読んだ結果であれば、探索せずにその評価値を使う。
        // ただし根（depth 0）では、指す手を確定させる必要があるため使わない。
        if(depth > 0 && tt.hitDepth >= remaining) {
          const score: number = Sikou.fromTTScore(tt.hitScore, depth);
          if(tt.hitFlag === TranspositionTable.EXACT) return score;
          if(tt.hitFlag === TranspositionTable.LOWER && score >= beta) return score;
          if(tt.hitFlag === TranspositionTable.UPPER && score <= alpha) return score;
        }
      }
    }
    // 探索前のαを保存しておく（置換表に保存する評価値の種類の判定に使う）
    const alphaOrig: number = alpha;

    // まずは合法手の生成
    let legalTe: Te[] = GenerateMoves.generateLegalMoves(k);

    // 合法手がない＝この局面の手番側は詰まされている。
    // 早く詰ませる（遅く詰まされる）ほど評価が高くなるよう、深さを加味する
    if(legalTe.length === 0) {
      return -(Sikou.INFINITE - depth);
    }

    // 良さそうな手から先に読むことで、βカットが起こりやすくなる
    Sikou.orderMoves(legalTe, ttMove);

    // 最大となる候補手の評価値
    let maxEva: number = -Sikou.INFINITE;
    // 合法手の内の一つを一手指してみて、その評価値を取得
    // 評価値が良ければmaxTe、maxEvaを更新
    for(let i: number = 0; i < legalTe.length; i++) {
      const tempTe: Te = legalTe[i];
      k.move(tempTe);
      k.teban = k.teban === SENTE ? GOTE : SENTE;

      // 次の局面の評価値を更に探索する
      // nextTempTeは現時点では次の深さに渡すダミーでしかない（読み筋を表示する際は必要となる
      let nextTempTe: Te = new Te(0, new Position(0, 0), new Position(0, 0), false, Koma.EMPTY);
      const tempEva: number = -this.negaMax(nextTempTe, k, -beta, -alpha, depth + 1, depthMax);
      // 忘れずに局面を戻す
      k.back(tempTe);
      k.teban = k.teban === SENTE ? GOTE : SENTE;
      // 評価値およびαβの更新、βカット
      if(tempEva > maxEva) {
        maxEva = tempEva;
        if(maxEva > alpha) alpha = maxEva;
        te.koma = tempTe.koma;
        te.from = tempTe.from;
        te.to = tempTe.to;
        te.promote = tempTe.promote;
        te.capture = tempTe.capture;
        if(tempEva >= beta) break;
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
    if(tt !== null) {
      let flag: number;
      if(maxEva <= alphaOrig) {
        flag = TranspositionTable.UPPER;
      } else if(maxEva >= beta) {
        flag = TranspositionTable.LOWER;
      } else {
        flag = TranspositionTable.EXACT;
      }
      const move: number = flag === TranspositionTable.UPPER ? 0 : TranspositionTable.packMove(te);
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
  static scoreMove(te: Te, ttMove: number): number {
    let score: number = 0;
    if(ttMove !== 0 && TranspositionTable.packMove(te) === ttMove) {
      score += 10000000;
    }
    if(te.capture !== Koma.EMPTY) {
      const victim: number = Math.abs(Kyokumen.komaValue[te.capture]);
      const attacker: number = Math.abs(Kyokumen.komaValue[te.koma]);
      score += 100000 + victim * 10 - attacker;
    }
    if(te.promote) {
      const gain: number = Math.abs(Kyokumen.komaValue[te.koma | Koma.PROMOTE])
        - Math.abs(Kyokumen.komaValue[te.koma]);
      score += 1000 + gain;
    }
    return score;
  }

  // 与えられた手のリストを、優先度の高い順にその場で並べ替える。
  // 優先度が同じ手は元の順序を保つ（安定）。
  // リストは短く、同順位の手が多いため、挿入ソートを用いる。
  static orderMoves(list: Te[], ttMove: number = 0): void {
    const n: number = list.length;
    const scores: number[] = new Array(n);
    for(let i: number = 0; i < n; i++) {
      scores[i] = Sikou.scoreMove(list[i], ttMove);
    }
    for(let i: number = 1; i < n; i++) {
      const te: Te = list[i];
      const score: number = scores[i];
      let j: number = i - 1;
      while(j >= 0 && scores[j] < score) {
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
  quiescence(k: Kyokumen, alpha: number, beta: number, qDepth: number): number {
    const standPat: number = k.teban === SENTE ? k.evaluate() : -k.evaluate();
    if(qDepth >= Sikou.QS_DEPTH_MAX) return standPat;
    if(standPat >= beta) return standPat;
    if(standPat > alpha) alpha = standPat;

    const captures: Te[] = GenerateMoves.generateCaptureMoves(k);
    Sikou.orderMoves(captures);
    let maxEva: number = standPat;
    for(let i: number = 0; i < captures.length; i++) {
      const tempTe: Te = captures[i];
      k.move(tempTe);
      k.teban = k.teban === SENTE ? GOTE : SENTE;
      const tempEva: number = -this.quiescence(k, -beta, -alpha, qDepth + 1);
      k.back(tempTe);
      k.teban = k.teban === SENTE ? GOTE : SENTE;
      if(tempEva > maxEva) {
        maxEva = tempEva;
        if(maxEva > alpha) alpha = maxEva;
        if(tempEva >= beta) break;
      }
    }
    return maxEva;
  }

}