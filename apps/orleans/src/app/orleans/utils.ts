export function batchArray<T>(items: T[], batchSize: number): T[][] {
  const result: T[][] = [];
  while (items.length) {
    const spliceCount = Math.min(batchSize, items.length);
    result.push(items.splice(0, spliceCount));
  }
  return result;
}
