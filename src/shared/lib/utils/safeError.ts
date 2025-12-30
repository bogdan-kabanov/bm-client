export const safeExecute = <T>(
  fn: () => T,
  onError?: (error: unknown) => void,
  defaultValue?: T
): T | undefined => {
  try {
    return fn();
  } catch (error) {
    if (onError) {
      onError(error);
    }
    return defaultValue;
  }
};

export const safeExecuteAsync = async <T>(
  fn: () => Promise<T>,
  onError?: (error: unknown) => void,
  defaultValue?: T
): Promise<T | undefined> => {
  try {
    return await fn();
  } catch (error) {
    if (onError) {
      onError(error);
    }
    return defaultValue;
  }
};

