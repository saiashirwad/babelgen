import {
  ArrayType,
  BaseType,
  FunctionType,
  GenericType,
  IntersectionType,
  ObjectType,
  PrimitiveType,
  UnionType,
} from "./types";
abstract class BaseExpr {
  abstract toString(): string;

  *[Symbol.iterator]() {
    yield this;
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
    return `let ${this.name}${typeAnnotation} = ${this.value.toString()};\n`;
  }
}

class IfExpr extends BaseExpr {
  constructor(
    public condition: Expr,
    public thenBranch: Expr,
    public elseBranch: Expr,
  ) {
    super();
  }

  toString(): string {
    return `if (${this.condition.toString()}) { ${this.thenBranch.toString()} } else { ${this.elseBranch.toString()} }`;
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
  | InterfaceExpr;

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

const $ = {
  number: (value: number, type?: BaseType) => new NumberExpr(value, type),
  string: (value: string, type?: BaseType) => new StringExpr(value, type),
  bool: (value: boolean, type?: BaseType) => new BoolExpr(value, type),

  let: (name: string, value: Expr, type?: BaseType) =>
    new LetExpr(name, value, type),

  if: (condition: Expr, thenBranch: Expr, elseBranch: Expr) =>
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

  raw: (value: string) => value,
  nl: () => "\n",
};

export const $$ = {
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
  yield* $$.typeAlias(
    "Point",
    $$.object({
      x: $$.primitive("T"),
      y: $$.primitive("T"),
    }),
    ["T"],
  );
  yield $.raw("hi");
  yield* $.nl();

  yield* $$.interface(
    "Repository",
    {
      findById: $$.function(
        [$$.primitive("string")],
        $$.generic("Promise", [$$.generic("T")]),
      ),
      save: $$.function(
        [$$.primitive("T")],
        $$.generic("Promise", [$$.primitive("void")]),
      ),
    },
    ["T"],
  );

  yield* $.let(
    "point",
    $.object({
      x: $.number(10),
      y: $.number(20),
    }),
    $$.generic("Point", [$$.primitive("number")]),
  );

  yield* $.let(
    "lol",
    $.fn(
      [
        { name: "items", type: $$.array($$.primitive("T")) },
        {
          name: "predicate",
          type: $$.function([$$.primitive("T")], $$.primitive("boolean")),
        },
      ],
      $.array([]),
      $$.array($$.primitive("T")),
      ["T"],
    ),
  );

  yield* $.number(2);
});

console.log(cw.run());
