export const enableFeature = <T>(envFlags: string[], asyncRunner: () => Promise<T>) => {
  if (envFlags.every((flag) => !!process.env[flag])) {
    return asyncRunner();
  }
  console.error(`WARN: Feature ${envFlags} is not enabled`);
  return Promise.resolve();
};
