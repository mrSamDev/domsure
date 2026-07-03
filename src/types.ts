export type SelectorSchema = Record<string, string>;

export type SelectorMap<T extends SelectorSchema> = {
  readonly [K in keyof T]: T[K];
};