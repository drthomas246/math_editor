export function doubleAll(values: number[]): number[] {
  function doubleValue(value: number): number {
    return value * 2;
  }
  return values.map(doubleValue);
}
