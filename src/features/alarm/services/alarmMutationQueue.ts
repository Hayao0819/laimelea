let pendingAlarmMutation: Promise<void> | null = null;

export function enqueueAlarmMutation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const result = pendingAlarmMutation
    ? pendingAlarmMutation.then(operation, operation)
    : operation();
  const completion = result.then(
    () => undefined,
    () => undefined,
  );
  pendingAlarmMutation = completion;
  completion.then(() => {
    if (pendingAlarmMutation === completion) {
      pendingAlarmMutation = null;
    }
  });
  return result;
}
