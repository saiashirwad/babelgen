export abstract class BaseType {
  abstract toString(): string;
}

export class PrimitiveType extends BaseType {
  constructor(public name: string) {
    super();
  }

  toString(): string {
    return this.name;
  }
}

export class GenericType extends BaseType {
  constructor(
    public name: string,
    public args: BaseType[],
  ) {
    super();
  }

  toString(): string {
    if (this.args.length === 0) return this.name;
    const args = this.args.map((arg) => arg.toString()).join(", ");
    return `${this.name}<${args}>`;
  }
}

export class ObjectType extends BaseType {
  constructor(
    public properties: Record<
      string,
      | BaseType
      | number
      | string
      | symbol
      | boolean
      | undefined
      | void
      | Record<any, any>
    >,
  ) {
    super();
  }

  toString(): string {
    const properties = Object.entries(this.properties)
      .map(([key, type]) => {
        if (type instanceof BaseType) return `${key}: ${type.toString()}`;
        return `${key}: ${JSON.stringify(type)}`;
      })
      .join("; ");
    return `{ ${properties} }`;
  }
}

export class ArrayType extends BaseType {
  constructor(public elementType: BaseType) {
    super();
  }

  toString(): string {
    return `${this.elementType.toString()}[]`;
  }
}

export class FunctionType extends BaseType {
  constructor(
    public params: BaseType[],
    public returnType: BaseType,
  ) {
    super();
  }

  toString(): string {
    const params = this.params.map((p) => p.toString()).join(", ");
    return `(${params}) => ${this.returnType.toString()}`;
  }
}

export class UnionType extends BaseType {
  constructor(public types: BaseType[]) {
    super();
  }

  toString(): string {
    return this.types.map((t) => t.toString()).join(" | ");
  }
}

export class IntersectionType extends BaseType {
  constructor(public types: BaseType[]) {
    super();
  }

  toString(): string {
    return this.types.map((t) => t.toString()).join(" & ");
  }
}

// export const primitive = (name: string) => new PrimitiveType(name);
// export const generic = (name: string, args: BaseType[] = []) =>
//   new GenericType(name, args);
// export const obj = (properties: Record<string, BaseType>) =>
//   new ObjectType(properties);
// export const array = (elementType: BaseType) => new ArrayType(elementType);
// export const fn = (params: BaseType[], returnType: BaseType) =>
//   new FunctionType(params, returnType);
// export const union = (...types: BaseType[]) => new UnionType(types);
// export const intersection = (...types: BaseType[]) =>
//
