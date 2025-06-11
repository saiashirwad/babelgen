const TAB = "  ";

abstract class BaseExpr {
  abstract toString(): string;

  *[Symbol.iterator]() {
    yield this;
  }
}

class BlockExpr extends BaseExpr {
  constructor(public block: () => Generator<Expr>) {
    super();
  }

  toString(indent = "") {
    let result = "{\n";
    for (const e of this.block()) {
      if (e instanceof IfExpr) {
        result += indent + TAB + e.toString(indent + TAB) + "\n";
      } else {
        result += indent + TAB + e.toString() + "\n";
      }
    }

    return result + indent + "}";
  }
}

class NumberExpr extends BaseExpr {
  constructor(
    public value: number,
    public type?: BaseType,
  ) {
    super();
  }

  toString(): string {
    const typeAnnotation = this.type ? `: ${this.type.toString()}` : "";
    return this.value.toString() + typeAnnotation;
  }
}

class StringExpr extends BaseExpr {
  constructor(
    public value: string,
    public type?: BaseType,
  ) {
    super();
  }

  toString(): string {
    const typeAnnotation = this.type ? `: ${this.type.toString()}` : "";
    return JSON.stringify(this.value) + typeAnnotation;
  }
}

class BoolExpr extends BaseExpr {
  constructor(
    public value: boolean,
    public type?: BaseType,
  ) {
    super();
  }

  toString(): string {
    const typeAnnotation = this.type ? `: ${this.type.toString()}` : "";
    return this.value.toString() + typeAnnotation;
  }
}

class LetExpr extends BaseExpr {
  constructor(
    public name: string,
    public value: Expr,
    public type?: BaseType,
  ) {
    super();
  }

  toString(): string {
    const typeAnnotation = this.type ? `: ${this.type.toString()}` : "";
    return `let ${this.name}${typeAnnotation} = ${this.value.toString()};`;
  }
}

class IfExpr extends BaseExpr {
  constructor(
    public condition: Expr,
    public thenBranch: BlockExpr,
    public elseBranch: BlockExpr,
  ) {
    super();
  }

  toString(indent = ""): string {
    let result = "if (" + this.condition.toString() + ") ";
    result += this.thenBranch.toString(indent);
    result += " else ";
    result += this.elseBranch.toString(indent);
    return result;
  }
}

class ObjectExpr extends BaseExpr {
  constructor(
    public properties: Record<string, Expr>,
    public type?: BaseType,
  ) {
    super();
  }

  toString(): string {
    const properties = Object.entries(this.properties)
      .map(([key, value]) => `${key}: ${value.toString()}`)
      .join(", ");
    const typeAnnotation = this.type ? `: ${this.type.toString()}` : "";
    return `{ ${properties} }${typeAnnotation}`;
  }
}

class ArrayExpr extends BaseExpr {
  constructor(
    public elements: Expr[],
    public type?: BaseType,
  ) {
    super();
  }

  toString(): string {
    const elements = this.elements
      .map((element) => element.toString())
      .join(", ");
    const typeAnnotation = this.type ? `: ${this.type.toString()}` : "";
    return `[ ${elements} ]${typeAnnotation}`;
  }
}

class FunctionExpr extends BaseExpr {
  constructor(
    public params: Array<{ name: string; type?: BaseType }>,
    public body: Expr,
    public returnType?: BaseType,
    public typeParams?: string[],
  ) {
    super();
  }

  toString(): string {
    const typeParamsStr = this.typeParams?.length
      ? `<${this.typeParams.join(", ")}>`
      : "";

    const params = this.params
      .map((p) => (p.type ? `${p.name}: ${p.type.toString()}` : p.name))
      .join(", ");

    const returnTypeStr = this.returnType
      ? `: ${this.returnType.toString()}`
      : "";

    return `${typeParamsStr}(${params})${returnTypeStr} => ${this.body.toString()}`;
  }
}

class TypeAliasExpr extends BaseExpr {
  constructor(
    public name: string,
    public type: BaseType,
    public typeParams?: string[],
  ) {
    super();
  }

  toString(): string {
    const typeParamsStr = this.typeParams?.length
      ? `<${this.typeParams.join(", ")}>`
      : "";
    return `type ${this.name}${typeParamsStr} = ${this.type.toString()};\n`;
  }
}

class InterfaceExpr extends BaseExpr {
  constructor(
    public name: string,
    public properties: Record<string, BaseType>,
    public typeParams?: string[],
  ) {
    super();
  }

  toString(): string {
    const typeParamsStr = this.typeParams?.length
      ? `<${this.typeParams.join(", ")}>`
      : "";

    const properties = Object.entries(this.properties)
      .map(([key, type]) => `  ${key}: ${type.toString()};`)
      .join("\n");

    return `interface ${this.name}${typeParamsStr} {\n${properties}\n}\n`;
  }
}

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

class RawExpr extends BaseExpr {
  constructor(public code: string) {
    super();
  }

  toString(): string {
    return this.code;
  }
}

type Expr =
  | NumberExpr
  | StringExpr
  | BoolExpr
  | LetExpr
  | IfExpr
  | ObjectExpr
  | ArrayExpr
  | FunctionExpr
  | TypeAliasExpr
  | InterfaceExpr
  | RawExpr;

class CodeWriter<const Y, const R> {
  constructor(public write: () => Generator<Y, R, void>) {}

  run() {
    let result = "";
    for (const value of this.write()) {
      result += value;
    }
    return result;
  }
}

const val = {
  number: (value: number, type?: BaseType) => new NumberExpr(value, type),
  string: (value: string, type?: BaseType) => new StringExpr(value, type),
  bool: (value: boolean, type?: BaseType) => new BoolExpr(value, type),

  let: (name: string, value: Expr, type?: BaseType) =>
    new LetExpr(name, value, type),

  if: (condition: Expr, thenBranch: BlockExpr, elseBranch: BlockExpr) =>
    new IfExpr(condition, thenBranch, elseBranch),

  object: (properties: Record<string, Expr>, type?: BaseType) =>
    new ObjectExpr(properties, type),

  array: (elements: Expr[], type?: BaseType) => new ArrayExpr(elements, type),

  fn: (
    params: Array<{ name: string; type?: BaseType }>,
    body: Expr,
    returnType?: BaseType,
    typeParams?: string[],
  ) => new FunctionExpr(params, body, returnType, typeParams),

  raw: (value: string) => new RawExpr(value),
  nl: () => "\n",

  block: (fn: () => Generator<Expr>) => new BlockExpr(fn),
};

export const type = {
  primitive: (name: string) => new PrimitiveType(name),
  generic: (name: string, args: BaseType[] = []) => new GenericType(name, args),
  object: (properties: Record<string, BaseType>) => new ObjectType(properties),
  array: (elementType: BaseType) => new ArrayType(elementType),
  function: (params: BaseType[], returnType: BaseType) =>
    new FunctionType(params, returnType),
  union: (...types: BaseType[]) => new UnionType(types),
  intersection: (...types: BaseType[]) => new IntersectionType(types),

  typeAlias: (name: string, type: BaseType, typeParams?: string[]) =>
    new TypeAliasExpr(name, type, typeParams),

  interface: (
    name: string,
    properties: Record<string, BaseType>,
    typeParams?: string[],
  ) => new InterfaceExpr(name, properties, typeParams),
};

const cw = new CodeWriter(function* () {
  yield* type.typeAlias(
    "Point",
    type.object({
      x: type.primitive("T"),
      y: type.primitive("T"),
    }),
    ["T"],
  );
  yield val.raw("hi");
  yield* val.nl();

  yield* type.interface(
    "Repository",
    {
      findById: type.function(
        [type.primitive("string")],
        type.generic("Promise", [type.generic("T")]),
      ),
      save: type.function(
        [type.primitive("T")],
        type.generic("Promise", [type.primitive("void")]),
      ),
    },
    ["T"],
  );

  yield* val.let(
    "point",
    val.object({
      x: val.number(10),
      y: val.number(20),
    }),
    type.generic("Point", [type.primitive("number")]),
  );

  yield* val.let(
    "lol",
    val.fn(
      [
        { name: "items", type: type.array(type.primitive("T")) },
        {
          name: "predicate",
          type: type.function([type.primitive("T")], type.primitive("boolean")),
        },
      ],
      val.array([]),
      type.array(type.primitive("T")),
      ["T"],
    ),
  );

  yield* val.number(2);
});

const cw2 = new CodeWriter(function* () {
  yield* val.block(function* () {
    yield* val.let("x", val.bool(true));
    yield* val.let("y", val.bool(false));

    yield* val.if(
      val.bool(true),
      val.block(function* () {
        yield* val.raw("console.log('Hello World!')");
      }),
      val.block(function* () {
        yield* val.raw("console.log('Hello World!')");
      }),
    );
  });
});

console.log(cw.run());
console.log("\n\n\n");
console.log(cw2.run());
