export type BenchmarkItem = {
  id: number;
  label: string;
  score: number;
  tags: readonly string[];
};

export function formatScore(value: number): string {
  return value.toFixed(2);
}
