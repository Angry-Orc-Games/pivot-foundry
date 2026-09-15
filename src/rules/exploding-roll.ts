export interface ExplodingOptions {
  critical?: boolean;
  enhanced?: boolean;
}
export interface DiceTerm {
  count: number;
  faces: number;
}
export interface ExplodingFormula {
  dice: DiceTerm[];
  modifier: number;
}
export interface ExplodingResult {
  complete: boolean;
  total: number | null;
  chains: Array<{ faces: number; results: number[] }>;
  modifier: number;
}

/** Additive positive dice and signed integer modifiers only. Null requires explicit ordinary fallback. */
export function parseExplodingFormula(formula: string): ExplodingFormula | null {
  const source = formula.replace(/\s/g, "");
  if (
    !source ||
    source.length > 1000 ||
    !/^[+]?\d*d\d+(?:[+]\d*d\d+|[+-]\d+)*$|^[+-]?\d+(?:[+]\d*d\d+|[+-]\d+)*$/i.test(source)
  )
    return null;
  const dice: DiceTerm[] = [];
  let modifier = 0;
  for (const token of source.match(/[+-]?[^+-]+/g) ?? []) {
    const match = /^\+?(\d*)d(\d+)$/i.exec(token);
    if (match) {
      const count = Number(match[1] || 1);
      const faces = Number(match[2]);
      if (
        !Number.isSafeInteger(count) ||
        count < 1 ||
        count > 1000 ||
        !Number.isSafeInteger(faces) ||
        faces < 2 ||
        faces > 1000000
      )
        throw new RangeError("Invalid dice");
      dice.push({ count, faces });
    } else modifier += Number(token);
  }
  if (!Number.isSafeInteger(modifier) || dice.reduce((sum, die) => sum + die.count, 0) > 1000)
    throw new RangeError("Invalid formula size");
  return { dice, modifier };
}

/** No explosion cap: a failed/cancelled provider produces an explicitly incomplete result. */
export async function rollExploding(
  formula: string,
  options: ExplodingOptions,
  rollDie: (faces: number) => Promise<number>,
): Promise<ExplodingResult> {
  const parsed = parseExplodingFormula(formula);
  if (!parsed) throw new RangeError("Unsupported formula");
  if (options.enhanced && parsed.dice.some((die) => die.faces === 2))
    throw new RangeError("Enhanced d2 cannot terminate");
  const result: ExplodingResult = {
    complete: false,
    total: null,
    chains: [],
    modifier: parsed.modifier,
  };
  let total = parsed.modifier;
  try {
    for (const die of parsed.dice) {
      for (let initial = 0; initial < die.count * (options.critical ? 2 : 1); initial++) {
        const chain = { faces: die.faces, results: [] as number[] };
        result.chains.push(chain);
        let face: number;
        do {
          face = await rollDie(die.faces);
          if (!Number.isInteger(face) || face < 1 || face > die.faces)
            throw new RangeError("Invalid die result");
          chain.results.push(face);
          total += face;
          if (!Number.isSafeInteger(total)) throw new RangeError("Roll total overflow");
        } while (face === die.faces || (options.enhanced && face === 1));
      }
    }
    result.complete = true;
    result.total = Math.max(0, total);
  } catch {
    /* Retain the visible partial chain, never offer an applicable amount. */
  }
  return result;
}
