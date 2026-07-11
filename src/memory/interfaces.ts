export const MemoryAdapter = {
  save: async (key: string, value: any) => ({ key, value }),
  load: async (key: string) => ({ key, value: null })
};
