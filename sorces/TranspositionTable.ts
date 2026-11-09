/* 置換表。局面ハッシュをキーに、その局面で行った探索の結果を保持する。
   同じ局面に別の手順で再び行き着いたとき（transposition）や、
   前の手番で読んだ局面に再び出会ったときに、探索結果を再利用するためのもの。

   エントリ数は2の累乗（1 << bits）個。局面ハッシュの下位bitsで格納位置を決め、
   同じ位置に別の局面が来た場合は、置き換え方針（storeを参照）に従う。
   速度とメモリ効率のため、エントリの各項目は型付き配列に分けて持つ。 */
class TranspositionTable {
  // 評価値の種類
  static readonly EXACT: number = 1;  // 正確な評価値
  static readonly LOWER: number = 2;  // 評価値は下限（βカットが起き、これ以上の可能性がある）
  static readonly UPPER: number = 3;  // 評価値は上限（αを超える手がなく、これ以下の可能性がある）

  private readonly mask: number;
  private readonly keyHi: Int32Array;
  private readonly keyLo: Int32Array;
  private readonly scores: Float64Array;  // 評価値は小数を含むためFloat64
  private readonly depths: Int8Array;     // 残り探索深さ
  private readonly flags: Uint8Array;     // 評価値の種類。0は未使用のエントリ
  private readonly ages: Uint8Array;      // 書き込んだ世代
  private readonly moves: Int32Array;     // 最善手（packMoveで圧縮したもの）。0は無し
  private generation: number = 0;

  // probeで見つかったエントリの内容の受け渡し用。
  // 探索中に何度も呼ばれるため、オブジェクトを都度生成せずプロパティに入れて返す。
  hitScore: number = 0;
  hitDepth: number = 0;
  hitFlag: number = 0;
  hitMove: number = 0;

  constructor(bits: number) {
    const size: number = 1 << bits;
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
  newGeneration(): void {
    this.generation = (this.generation + 1) & 0xff;
  }

  // 全エントリを消去する
  clear(): void {
    this.flags.fill(0);
    this.generation = 0;
  }

  // 局面のキーでエントリを探す。見つかればtrueを返し、hit〜プロパティに内容を入れる。
  probe(hi: number, lo: number): boolean {
    const idx: number = lo & this.mask;
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
  store(hi: number, lo: number, depth: number, score: number, flag: number, move: number): void {
    const idx: number = lo & this.mask;
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
  static packMove(te: Te): number {
    return te.koma | (te.from.suji << 6) | (te.from.dan << 10)
      | (te.to.suji << 14) | (te.to.dan << 18) | ((te.promote ? 1 : 0) << 22);
  }
}
