import { convex } from "./convex";

export async function q<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  return (convex as any).query(name, args) as Promise<T>;
}

export async function m<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  return (convex as any).mutation(name, args) as Promise<T>;
}

export function asId(value: unknown): string {
  return String(value);
}

export function optionalId(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  return String(value);
}
