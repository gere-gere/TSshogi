/* 詰探索（深さ優先探索、反復深化）
  攻め方は王手の手だけ、受け方は全ての合法手（＝王手回避）を読む。
  攻め方は「どれか一手で詰ませられればよい」(OR)、
  受け方は「全ての応手で詰んでいなければならない」(AND)という交互の構造。
  評価値は使わず、詰むかどうかだけを判定する。
  手数の上限は反復深化で1手詰め、3手詰め、5手詰め…と浅い方から順に試すため、
  最短の詰みが見つかる。ノード数の上限に達した場合は打ち切って詰みなしとして扱う。 */
class Tsume {
  // 一回の詰探索（反復深化の全体）で読むノード数の上限
  static readonly NODE_MAX = 100000;

  // 探索したノード数
  nodes: number = 0;
  // ノード数の上限に達して打ち切ったか
  aborted: boolean = false;
  // 詰みが見つかった手数
  foundDepth: number = 0;

  private nodeMax: number;
  // 根での詰ませる最初の一手
  private rootTe: Te | null = null;

  constructor(nodeMax: number = Tsume.NODE_MAX) {
    this.nodeMax = nodeMax;
  }

  /* 手番側から見て、depthMax手以内の詰みがあればその最初の一手を返す。なければnull。
    局面kは探索中に書き換えるが、リターン時には元に戻っている。
    （手番k.tebanは探索中に手を指す度に入れ替え、戻す） */
  search(k: Kyokumen, depthMax: number): Te | null {
    this.nodes = 0;
    this.aborted = false;
    this.foundDepth = 0;
    this.rootTe = null;
    // 詰みの手数は奇数（攻め方の手で終わる）なので、1手詰めから2手ずつ深くする
    for (let depth: number = 1; depth <= depthMax; depth += 2) {
      if (this.orNode(k, depth, true)) {
        this.foundDepth = depth;
        return this.rootTe;
      }
      // 上限に達していたら、これ以上深くしても読み切れない
      if (this.aborted) break;
    }
    return null;
  }

  // 攻め方の手番。残りdepth手（攻め方の手を含む）以内に詰ませられるかを返す。
  private orNode(k: Kyokumen, depth: number, isRoot: boolean): boolean {
    if (depth <= 0) return false;
    if (this.nodes >= this.nodeMax) {
      this.aborted = true;
      return false;
    }
    this.nodes++;

    const checkTe: Te[] = GenerateMoves.generateCheckMoves(k);
    for (let i: number = 0; i < checkTe.length; i++) {
      const te: Te = checkTe[i];
      k.move(te);
      k.teban = k.teban === SENTE ? GOTE : SENTE;
      const mated: boolean = this.andNode(k, depth - 1);
      // 忘れずに局面を戻す
      k.back(te);
      k.teban = k.teban === SENTE ? GOTE : SENTE;
      if (mated) {
        if (isRoot) this.rootTe = te;
        return true;
      }
      // 打ち切られた後は、これ以上読んでも結果が信用できない
      if (this.aborted) return false;
    }
    return false;
  }

  // 受け方の手番。残りdepth手（受け方の手を含む）以内に全ての応手を詰ませられるかを返す。
  private andNode(k: Kyokumen, depth: number): boolean {
    if (this.nodes >= this.nodeMax) {
      this.aborted = true;
      return false;
    }
    this.nodes++;

    // 王手がかかっているので、合法手は王手回避の手だけになる
    const legalTe: Te[] = GenerateMoves.generateLegalMoves(k);
    // 応手がなければ詰み
    if (legalTe.length === 0) return true;
    // 手数を使い切っていれば、詰んでいないので失敗
    if (depth <= 0) return false;

    for (let i: number = 0; i < legalTe.length; i++) {
      const te: Te = legalTe[i];
      k.move(te);
      k.teban = k.teban === SENTE ? GOTE : SENTE;
      const mated: boolean = this.orNode(k, depth - 1, false);
      k.back(te);
      k.teban = k.teban === SENTE ? GOTE : SENTE;
      // 一つでも逃れられる応手があれば失敗。
      // （打ち切られた場合も、falseが返るのでここで抜ける）
      if (!mated) return false;
    }
    return true;
  }
}
