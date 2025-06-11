export const isObject = (value: unknown) =>
  typeof value === "object" && value !== null;

export const isPrimitive = (value: unknown) =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean" ||
  value === null ||
  value === undefined;

export const isArray = (value: unknown) => Array.isArray(value);
export const isFunction = (value: unknown) => typeof value === "function";
export const isNull = (value: unknown) => value === null;
export const isUndefined = (value: unknown) => value === undefined;
export const isString = (value: unknown) => typeof value === "string";
export const isNumber = (value: unknown) => typeof value === "number";
export const isBoolean = (value: unknown) => typeof value === "boolean";
export const isSymbol = (value: unknown) => typeof value === "symbol";
