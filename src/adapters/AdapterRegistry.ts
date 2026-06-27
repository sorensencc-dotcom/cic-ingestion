import { BaseAdapter, AdapterConfig } from "./BaseAdapter";

export class AdapterRegistry {
  private adapters = new Map<string, BaseAdapter>();

  register(name: string, adapter: BaseAdapter): void {
    this.adapters.set(name, adapter);
  }

  get(name: string): BaseAdapter | null {
    return this.adapters.get(name) || null;
  }

  getAll(): Record<string, BaseAdapter> {
    const result: Record<string, BaseAdapter> = {};
    this.adapters.forEach((adapter, name) => {
      result[name] = adapter;
    });
    return result;
  }

  has(name: string): boolean {
    return this.adapters.has(name);
  }

  unregister(name: string): boolean {
    return this.adapters.delete(name);
  }

  clear(): void {
    this.adapters.clear();
  }
}
