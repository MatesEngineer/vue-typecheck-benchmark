export type BenchmarkItem = {
  id: number;
  label: string;
  score: number;
  tags: readonly string[];
};

export type ItemStatus =
  | { kind: "ready"; value: number }
  | { kind: "blocked"; reason: string };

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export function formatScore(value: number): string {
  return value.toFixed(2);
}

export function getItemStatus(item: DeepReadonly<BenchmarkItem>): ItemStatus {
  return item.score >= 0
    ? { kind: "ready", value: item.score }
    : { kind: "blocked", reason: `negative score: ${item.score}` };
}

export function firstTag<T extends DeepReadonly<BenchmarkItem>>(item: T): string {
  return item.tags[0] ?? "untagged";
}
