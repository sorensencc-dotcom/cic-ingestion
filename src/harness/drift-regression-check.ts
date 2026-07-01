export function driftRegressionCheck(values: number[]) {
  const last = values[values.length - 1];
  const first = values[0];
  const trend = last - first;

  return {
    first,
    last,
    trend,
    passed: last < 0.75 && trend < 0.15,
  };
}
