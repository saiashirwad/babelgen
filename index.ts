export const isObject = (value: unknown) => typeof value === "object" && value !== null

export const isPrimitive = (value: unknown) =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean" ||
  value === null ||
  value === undefined

export const isArray = (value: unknown) => Array.isArray(value)
export const isFunction = (value: unknown) => typeof value === "function"
export const isNull = (value: unknown) => value === null
export const isUndefined = (value: unknown) => value === undefined
export const isString = (value: unknown) => typeof value === "string"
export const isNumber = (value: unknown) => typeof value === "number"
export const isBoolean = (value: unknown) => typeof value === "boolean"
export const isSymbol = (value: unknown) => typeof value === "symbol"

const TAB = "  "

abstract class BaseExpr {
  abstract toString(): string

  *[Symbol.iterator](): Generator<this, any> {
    yield this
  }
}

class BlockExpr extends BaseExpr {
  constructor(public block: () => Generator<ValueExpr>) {
    super()
  }

  toString(indent = "") {
    let result = "{\n"
    for (const e of this.block()) {
      if (e instanceof IfExpr || e instanceof ForExpr || e instanceof WhileExpr) {
        result += indent + TAB + e.toString(indent + TAB) + "\n"
      } else if (e instanceof BaseExpr) {
        const lines = e.toString().split("\n")
        result += indent + TAB + lines[0] + "\n"
        for (let i = 1; i < lines.length; i++) {
          result += indent + TAB + lines[i] + "\n"
        }
      } else {
        result += indent + TAB + JSON.stringify(e) + "\n"
      }
    }

    return result + indent + "}"
  }
}

class VarRef<const Type> extends BaseExpr {
  constructor(
    public name: string,
    public type?: BaseType
  ) {
    super()
  }

  toString(): string {
    return this.name
  }
}

class NumberExpr extends BaseExpr {
  constructor(
    public value: number,
    public type?: BaseType
  ) {
    super()
  }

  toString(): string {
    const typeAnnotation = this.type ? `: ${this.type.toString()}` : ""
    return this.value.toString() + typeAnnotation
  }

  *[Symbol.iterator]() {
    return this
  }
}

class StringExpr extends BaseExpr {
  constructor(
    public value: string,
    public type?: BaseType
  ) {
    super()
  }

  toString(): string {
    const typeAnnotation = this.type ? `: ${this.type.toString()}` : ""
    return JSON.stringify(this.value) + typeAnnotation
  }
}

class BoolExpr extends BaseExpr {
  constructor(
    public value: boolean,
    public type?: BaseType
  ) {
    super()
  }

  toString(): string {
    const typeAnnotation = this.type ? `: ${this.type.toString()}` : ""
    return this.value.toString() + typeAnnotation
  }
}

type LetInfer<Value extends ValueExpr> =
  Value extends number ? number
  : Value extends string ? string
  : Value extends boolean ? boolean
  : Value extends VarRef<infer Type> ? Type
  : Value extends ObjectExpr ? Record<string, any>
  : Value extends ArrayExpr ? any[]
  : Value extends FunctionExpr ? any
  : Value extends FunctionCallExpr ? any
  : Value extends MethodCallExpr ? any
  : Value extends TypeAliasExpr ? any
  : Value extends InterfaceExpr ? any
  : Value extends RawExpr ? any
  : Value extends BlockExpr ? any
  : Value extends NumericBinaryOpExpr ? number
  : Value extends UnaryOpExpr ? any
  : Value extends PropertyAccessExpr<infer _, infer __, infer T> ? T
  : Value extends TemplateLiteralExpr ? any
  : Value extends NumberExpr ? number
  : Value extends Record<any, any> ?
    {
      -readonly [k in keyof Value]: LetInfer<Value[k]>
    }
  : any

class LetExpr<const Value extends ValueExpr> extends BaseExpr {
  constructor(
    public name: string,
    public value: ValueExpr,
    public type?: BaseType
  ) {
    super()
  }

  toString(): string {
    const typeAnnotation = this.type ? `: ${this.type.toString()}` : ""
    const valueStr =
      this.value instanceof BaseExpr ? this.value.toString() : JSON.stringify(this.value)
    return `let ${this.name}${typeAnnotation} = ${valueStr};`
  }

  *[Symbol.iterator](): Generator<never, VarRef<LetInfer<Value>>, unknown> {
    // @ts-ignore
    yield this
    return new VarRef<LetInfer<Value>>(this.name, this.type)
  }
}

class IfExpr extends BaseExpr {
  constructor(
    public condition: ValueExpr,
    public thenBranch: BlockExpr,
    public elseBranch: BlockExpr
  ) {
    super()
  }

  toString(indent = ""): string {
    const conditionStr =
      this.condition instanceof BaseExpr ?
        this.condition.toString()
      : JSON.stringify(this.condition)
    let result = "if (" + conditionStr + ") "
    result += this.thenBranch.toString(indent)
    result += " else "
    result += this.elseBranch.toString(indent)
    return result
  }
}

class ForExpr extends BaseExpr {
  constructor(
    public init: ValueExpr | undefined,
    public variable: string,
    public iterable: ValueExpr,
    public body: (loopVar: VarRef<any>) => Generator<ValueExpr>,
    public type: "for-of" | "for-in" | "for" = "for-of"
  ) {
    super()
  }

  toString(indent = ""): string {
    let result = ""

    if (this.type === "for-of") {
      const iterableStr =
        this.iterable instanceof BaseExpr ? this.iterable.toString() : String(this.iterable)
      result = `for (const ${this.variable} of ${iterableStr}) `
    } else if (this.type === "for-in") {
      const iterableStr =
        this.iterable instanceof BaseExpr ? this.iterable.toString() : String(this.iterable)
      result = `for (const ${this.variable} in ${iterableStr}) `
    } else {
      // Traditional for loop
      const initStr =
        this.init instanceof BaseExpr ? this.init.toString() : JSON.stringify(this.init)
      const conditionStr = this.variable // reuse for condition
      const incrementStr =
        this.iterable instanceof BaseExpr ? this.iterable.toString() : JSON.stringify(this.iterable)
      result = `for (${initStr}; ${conditionStr}; ${incrementStr}) `
    }

    result += "{\n"
    const loopVar = new VarRef(this.variable)
    for (const expr of this.body(loopVar)) {
      if (expr instanceof IfExpr || expr instanceof ForExpr || expr instanceof WhileExpr) {
        result += indent + TAB + expr.toString(indent + TAB) + "\n"
      } else if (expr instanceof BaseExpr) {
        result += indent + TAB + expr.toString() + "\n"
      } else {
        result += indent + TAB + JSON.stringify(expr) + "\n"
      }
    }
    result += indent + "}"

    return result
  }
}

class WhileExpr extends BaseExpr {
  constructor(
    public condition: ValueExpr,
    public body: () => Generator<ValueExpr>
  ) {
    super()
  }

  toString(indent = ""): string {
    const conditionStr =
      this.condition instanceof BaseExpr ?
        this.condition.toString()
      : JSON.stringify(this.condition)

    let result = `while (${conditionStr}) {\n`
    for (const expr of this.body()) {
      if (expr instanceof IfExpr || expr instanceof ForExpr || expr instanceof WhileExpr) {
        result += indent + TAB + expr.toString(indent + TAB) + "\n"
      } else if (expr instanceof BaseExpr) {
        result += indent + TAB + expr.toString() + "\n"
      } else {
        result += indent + TAB + JSON.stringify(expr) + "\n"
      }
    }
    result += indent + "}"

    return result
  }
}

class ObjectExpr extends BaseExpr {
  constructor(
    public properties: Record<string, ValueExpr>,
    public type?: BaseType
  ) {
    super()
  }

  toString(): string {
    const properties = Object.entries(this.properties)
      .map(([key, value]) => {
        const valueStr = value instanceof BaseExpr ? value.toString() : JSON.stringify(value)
        return `${key}: ${valueStr}`
      })
      .join(", ")
    const typeAnnotation = this.type ? `: ${this.type.toString()}` : ""
    return `{ ${properties} }${typeAnnotation}`
  }
}

class ArrayExpr extends BaseExpr {
  constructor(
    public elements: ValueExpr[],
    public type?: BaseType
  ) {
    super()
  }

  toString(): string {
    const elements = this.elements
      .map(element => {
        const elementStr =
          element instanceof BaseExpr ? element.toString() : JSON.stringify(element)
        return elementStr
      })
      .join(", ")
    const typeAnnotation = this.type ? `: ${this.type.toString()}` : ""
    return `[ ${elements} ]${typeAnnotation}`
  }
}

class FunctionExpr extends BaseExpr {
  constructor(
    public params: Array<{ name: string; type?: BaseType }>,
    public body: (args: Record<string, VarRef<any>>) => Generator<ValueExpr, ValueExpr>,
    public returnType?: BaseType,
    public typeParams?: string[]
  ) {
    super()
  }

  toString(): string {
    const typeParamsStr = this.typeParams?.length ? `<${this.typeParams.join(", ")}>` : ""

    const params = this.params
      .map(p => (p.type ? `${p.name}: ${p.type.toString()}` : p.name))
      .join(", ")

    const returnTypeStr = this.returnType ? `: ${this.returnType.toString()}` : ""

    let bodyStr = "{\n"
    const args = this.params.reduce(
      (acc, param) => {
        acc[param.name] = new VarRef(param.name, param.type)
        return acc
      },
      {} as Record<string, VarRef<any>>
    )
    const generator = this.body(args)
    let result = generator.next()

    while (!result.done) {
      const expr = result.value
      if (expr instanceof IfExpr) {
        bodyStr += TAB + expr.toString(TAB) + "\n"
      } else if (expr instanceof BaseExpr) {
        bodyStr += TAB + expr.toString() + "\n"
      } else {
        bodyStr += TAB + JSON.stringify(expr) + "\n"
      }
      result = generator.next()
    }

    // Handle return value
    if (result.value !== undefined) {
      const returnExpr = result.value
      if (returnExpr instanceof BaseExpr) {
        bodyStr += TAB + "return " + returnExpr.toString() + ";\n"
      } else {
        bodyStr += TAB + "return " + JSON.stringify(returnExpr) + ";\n"
      }
    }

    bodyStr += "}"

    return `${typeParamsStr}(${params})${returnTypeStr} => ${bodyStr}`
  }
}

class TypeAliasExpr extends BaseExpr {
  constructor(
    public name: string,
    public type: BaseType,
    public typeParams?: string[]
  ) {
    super()
  }

  toString(): string {
    const typeParamsStr = this.typeParams?.length ? `<${this.typeParams.join(", ")}>` : ""
    return `type ${this.name}${typeParamsStr} = ${this.type.toString()};\n`
  }
}

class InterfaceExpr extends BaseExpr {
  constructor(
    public name: string,
    public properties: Record<string, BaseType>,
    public typeParams?: string[]
  ) {
    super()
  }

  toString(): string {
    const typeParamsStr = this.typeParams?.length ? `<${this.typeParams.join(", ")}>` : ""

    const properties = Object.entries(this.properties)
      .map(([key, type]) => `  ${key}: ${type.toString()};`)
      .join("\n")

    return `interface ${this.name}${typeParamsStr} {\n${properties}\n}\n`
  }
}

export abstract class BaseType {
  abstract toString(): string
}

export class PrimitiveType extends BaseType {
  constructor(public name: string) {
    super()
  }

  toString(): string {
    return this.name
  }
}

export class VariableType<
  TypeContext extends { [k: string]: any },
  Type extends keyof TypeContext
> extends BaseType {
  constructor(public name: Type) {
    super()
  }

  toString(): string {
    return this.name as string
  }
}

export class GenericType extends BaseType {
  constructor(
    public name: string,
    public args: BaseType[]
  ) {
    super()
  }

  toString(): string {
    if (this.args.length === 0) return this.name
    const args = this.args.map(arg => arg.toString()).join(", ")
    return `${this.name}<${args}>`
  }
}

export class ObjectType extends BaseType {
  constructor(public properties: Record<string, ValueExpr>) {
    super()
  }

  toString(): string {
    const properties = Object.entries(this.properties)
      .map(([key, type]) => {
        if (type instanceof BaseType) return `${key}: ${type.toString()}`
        return `${key}: ${JSON.stringify(type)}`
      })
      .join("; ")
    return `{ ${properties} }`
  }
}

export class ArrayType extends BaseType {
  constructor(public elementType: BaseType) {
    super()
  }

  toString(): string {
    return `${this.elementType.toString()}[]`
  }
}

export class FunctionType extends BaseType {
  constructor(
    public params: BaseType[],
    public returnType: BaseType
  ) {
    super()
  }

  toString(): string {
    const params = this.params.map(p => p.toString()).join(", ")
    return `(${params}) => ${this.returnType.toString()}`
  }
}

export class UnionType extends BaseType {
  constructor(public types: BaseType[]) {
    super()
  }

  toString(): string {
    return this.types.map(t => t.toString()).join(" | ")
  }
}

export class IntersectionType extends BaseType {
  constructor(public types: BaseType[]) {
    super()
  }

  toString(): string {
    return this.types.map(t => t.toString()).join(" & ")
  }
}

class FunctionCallExpr extends BaseExpr {
  constructor(
    public functionRef: ValueExpr,
    public args: ValueExpr[]
  ) {
    super()
  }

  toString(): string {
    const funcStr =
      this.functionRef instanceof BaseExpr ? this.functionRef.toString()
      : typeof this.functionRef === "string" ? this.functionRef
      : JSON.stringify(this.functionRef)

    const argsStr = this.args
      .map(arg => {
        const argStr = arg instanceof BaseExpr ? arg.toString() : JSON.stringify(arg)
        return argStr
      })
      .join(", ")

    return `${funcStr}(${argsStr})`
  }
}

class MethodCallExpr extends BaseExpr {
  constructor(
    public object: ValueExpr,
    public method: string,
    public args: ValueExpr[]
  ) {
    super()
  }

  toString(): string {
    const objStr =
      this.object instanceof BaseExpr ? this.object.toString()
      : typeof this.object === "string" ? this.object
      : JSON.stringify(this.object)

    const argsStr = this.args
      .map(arg => {
        const argStr = arg instanceof BaseExpr ? arg.toString() : JSON.stringify(arg)
        return argStr
      })
      .join(", ")

    return `${objStr}.${this.method}(${argsStr})`
  }
}

class RawExpr extends BaseExpr {
  constructor(public code: string) {
    super()
  }

  toString(): string {
    return this.code
  }
}

class NumericBinaryOpExpr extends BaseExpr {
  constructor(
    public left: VarRefOrType<number>,
    public operator: string,
    public right: VarRefOrType<number>
  ) {
    super()
  }

  toString(): string {
    const leftStr = this.left instanceof BaseExpr ? this.left.toString() : JSON.stringify(this.left)
    const rightStr =
      this.right instanceof BaseExpr ? this.right.toString() : JSON.stringify(this.right)
    return `${leftStr} ${this.operator} ${rightStr}`
  }

  *[Symbol.iterator]() {
    yield this
    return new VarRef<number>("result", type.primitive("number"))
  }
}

class LogicalBinaryOpExpr extends BaseExpr {
  constructor(
    public left: VarRefOrType<boolean>,
    public operator: string,
    public right: VarRefOrType<boolean>
  ) {
    super()
  }

  toString(): string {
    const leftStr = this.left instanceof BaseExpr ? this.left.toString() : JSON.stringify(this.left)
    const rightStr =
      this.right instanceof BaseExpr ? this.right.toString() : JSON.stringify(this.right)
    return `${leftStr} ${this.operator} ${rightStr}`
  }

  *[Symbol.iterator]() {
    yield this
    return new VarRef<boolean>("result", type.primitive("boolean"))
  }
}

class UnaryOpExpr extends BaseExpr {
  constructor(
    public operator: string,
    public operand: ValueExpr,
    public prefix: boolean = true
  ) {
    super()
  }

  toString(): string {
    const operandStr =
      this.operand instanceof BaseExpr ? this.operand.toString() : JSON.stringify(this.operand)
    return this.prefix ? `${this.operator}${operandStr}` : `${operandStr}${this.operator}`
  }
}

type VarRefInner<T> = T extends VarRef<infer U> ? U : never

class PropertyAccessExpr<
  const Value extends VarRef<any>,
  const Property extends keyof VarRefInner<Value>,
  const PropertyType extends VarRefInner<Value>[Property] = VarRefInner<Value>[Property]
> extends BaseExpr {
  constructor(
    public object: Value,
    public property: Property,
    public computed: boolean = false
  ) {
    super()
  }

  toString(): string {
    const objStr =
      this.object instanceof BaseExpr ? this.object.toString() : JSON.stringify(this.object)

    if (this.computed) {
      const propStr =
        this.property instanceof BaseExpr ? this.property.toString() : JSON.stringify(this.property)
      return `${objStr}[${propStr}]`
    } else {
      const propStr =
        this.property instanceof BaseExpr ? this.property.toString() : String(this.property)
      return `${objStr}.${propStr}`
    }
  }

  *[Symbol.iterator](): Generator<this, VarRef<string>, unknown> {
    yield this
    return new VarRef<string>("", type.primitive("any"))
  }
}

class TemplateLiteralExpr extends BaseExpr {
  constructor(
    public parts: string[],
    public expressions: ValueExpr[]
  ) {
    super()
  }

  toString(): string {
    let result = "`"
    for (let i = 0; i < this.parts.length; i++) {
      result += this.parts[i]
      if (i < this.expressions.length) {
        const exprStr =
          this.expressions[i] instanceof BaseExpr ?
            this.expressions[i].toString()
          : JSON.stringify(this.expressions[i])
        result += `\${${exprStr}}`
      }
    }
    result += "`"
    return result
  }
}

type Expr =
  | VarRef<any>
  | NumberExpr
  | StringExpr
  | BoolExpr
  | LetExpr<any>
  | IfExpr
  | ForExpr
  | WhileExpr
  | ObjectExpr
  | ArrayExpr
  | FunctionExpr
  | FunctionCallExpr
  | MethodCallExpr
  | TypeAliasExpr
  | InterfaceExpr
  | RawExpr
  | BlockExpr
  | NumericBinaryOpExpr
  | LogicalBinaryOpExpr
  | UnaryOpExpr
  | PropertyAccessExpr<any, never>
  | TemplateLiteralExpr

type Primitive = number | string | boolean | symbol | Record<string, any>
type ValueExpr = Expr | Primitive
type FunctionBody = () => Generator<ValueExpr, ValueExpr>

type VarRefOrType<T> = VarRef<T> | T

function printValue(val: ValueExpr) {
  if (val instanceof BaseExpr) {
    return val.toString()
  }
  if (isObject(val)) {
    console.log(val)
  }
}

type CodeWriter = {
  run: () => string
}

function CodeWriter<const Y>(write: () => Generator<Y, void>): CodeWriter {
  return {
    run: () => {
      let result = ""
      for (const value of write()) {
        result += value
      }
      return result
    }
  }
}

type NumericBinaryOpParam = VarRefOrType<number> | number
type LogicalBinaryOpParam = VarRefOrType<boolean> | boolean

export const numeric = {
  add: (left: VarRefOrType<number>, right: VarRefOrType<number>) =>
    new NumericBinaryOpExpr(left, "+", right),
  subtract: (left: NumericBinaryOpParam, right: NumericBinaryOpParam) =>
    new NumericBinaryOpExpr(left, "-", right),
  multiply: (left: NumericBinaryOpParam, right: NumericBinaryOpParam) =>
    new NumericBinaryOpExpr(left, "*", right),
  divide: (left: NumericBinaryOpParam, right: NumericBinaryOpParam) =>
    new NumericBinaryOpExpr(left, "/", right),
  modulo: (left: NumericBinaryOpParam, right: NumericBinaryOpParam) =>
    new NumericBinaryOpExpr(left, "%", right),
  power: (left: NumericBinaryOpParam, right: NumericBinaryOpParam) =>
    new NumericBinaryOpExpr(left, "**", right),

  // Comparison operations
  gt: (left: NumericBinaryOpParam, right: NumericBinaryOpParam) =>
    new NumericBinaryOpExpr(left, ">", right),
  lt: (left: NumericBinaryOpParam, right: NumericBinaryOpParam) =>
    new NumericBinaryOpExpr(left, "<", right),
  gte: (left: NumericBinaryOpParam, right: NumericBinaryOpParam) =>
    new NumericBinaryOpExpr(left, ">=", right),
  lte: (left: NumericBinaryOpParam, right: NumericBinaryOpParam) =>
    new NumericBinaryOpExpr(left, "<=", right),
  eq: (left: NumericBinaryOpParam, right: NumericBinaryOpParam) =>
    new NumericBinaryOpExpr(left, "==", right)
}

export const logical = {
  and: (left: LogicalBinaryOpParam, right: LogicalBinaryOpParam) =>
    new LogicalBinaryOpExpr(left, "&&", right),
  or: (left: LogicalBinaryOpParam, right: LogicalBinaryOpParam) =>
    new LogicalBinaryOpExpr(left, "||", right)
}

const val = {
  number: (value: number, type?: BaseType) => new NumberExpr(value, type),

  string: (value: string, type?: BaseType) => new StringExpr(value, type),

  bool: (value: boolean, type?: BaseType) => new BoolExpr(value, type),

  let: <const Value extends ValueExpr>(name: string, value: Value, type?: BaseType) =>
    new LetExpr<Value>(name, value, type),

  if: (condition: ValueExpr, thenBranch: BlockExpr, elseBranch: BlockExpr) =>
    new IfExpr(condition, thenBranch, elseBranch),

  object: (properties: Record<string, ValueExpr>, type?: BaseType) =>
    new ObjectExpr(properties, type),

  array: (elements: ValueExpr[], type?: BaseType) => new ArrayExpr(elements, type),

  fn: (
    params: Array<{ name: string; type?: BaseType }>,
    body: (args: Record<string, VarRef<any>>) => Generator<ValueExpr, ValueExpr>,
    returnType?: BaseType,
    typeParams?: string[]
  ) => new FunctionExpr(params, body, returnType, typeParams),

  raw: (value: string) => new RawExpr(value),

  nl: () => new RawExpr("\n"),

  block: (fn: () => Generator<ValueExpr>) => new BlockExpr(fn),

  fnBlock: (fn: (args: Record<string, VarRef<any>>) => Generator<ValueExpr, ValueExpr>) => fn,

  call: (functionRef: ValueExpr, args: ValueExpr[] = []) => new FunctionCallExpr(functionRef, args),

  methodCall: (object: ValueExpr, method: string, args: ValueExpr[] = []) =>
    new MethodCallExpr(object, method, args),

  forOf: (
    variable: string,
    iterable: ValueExpr,
    body: (loopVar: VarRef<any>) => Generator<ValueExpr>
  ) => new ForExpr(undefined, variable, iterable, body, "for-of"),

  forIn: (
    variable: string,
    iterable: ValueExpr,
    body: (loopVar: VarRef<any>) => Generator<ValueExpr>
  ) => new ForExpr(undefined, variable, iterable, body, "for-in"),

  for: (
    init: ValueExpr,
    condition: string,
    increment: ValueExpr,
    body: (loopVar: VarRef<any>) => Generator<ValueExpr>
  ) => new ForExpr(init, condition, increment, body, "for"),

  while: (condition: ValueExpr, body: () => Generator<ValueExpr>) => new WhileExpr(condition, body),

  not: (operand: ValueExpr) => new UnaryOpExpr("!", operand),
  negate: (operand: ValueExpr) => new UnaryOpExpr("-", operand),
  plus: (operand: ValueExpr) => new UnaryOpExpr("+", operand),
  increment: (operand: ValueExpr, prefix = true) => new UnaryOpExpr("++", operand, prefix),
  decrement: (operand: ValueExpr, prefix = true) => new UnaryOpExpr("--", operand, prefix),

  prop: <const Value extends VarRef<Record<any, any>>, Property extends keyof VarRefInner<Value>>(
    object: Value,
    property: Property
  ) => new PropertyAccessExpr(object, property, false),
  index: <const Value extends VarRef<Record<any, any>>, Property extends keyof VarRefInner<Value>>(
    object: Value,
    index: Property
  ) => new PropertyAccessExpr(object, index, true),

  // Template literal
  template: (parts: string[], ...expressions: ValueExpr[]) =>
    new TemplateLiteralExpr(parts, expressions)
}

export const type = {
  primitive: (name: string) => new PrimitiveType(name),

  variable: <TypeContext extends { [k: string]: any }, Type extends keyof TypeContext & string>(
    name: Type
  ) => new VariableType(name),

  generic: (name: string, args: BaseType[] = []) => new GenericType(name, args),

  object: (properties: Record<string, BaseType>) => new ObjectType(properties),

  array: (elementType: BaseType) => new ArrayType(elementType),

  function: (params: BaseType[], returnType: BaseType) => new FunctionType(params, returnType),

  union: (...types: BaseType[]) => new UnionType(types),

  intersection: (...types: BaseType[]) => new IntersectionType(types),

  typeAlias: (name: string, type: BaseType, typeParams?: string[]) =>
    new TypeAliasExpr(name, type, typeParams),

  interface: (name: string, properties: Record<string, BaseType>, typeParams?: string[]) =>
    new InterfaceExpr(name, properties, typeParams)
}

// const cw = CodeWriter(function* () {
//   yield* val.block(function* () {
//     yield* type.typeAlias(
//       "Point",
//       type.object({
//         x: type.primitive("T"),
//         y: type.primitive("T")
//       }),
//       ["T"]
//     )
//     yield* val.nl()
//
//     yield* type.interface(
//       "Repository",
//       {
//         findById: type.function(
//           [type.primitive("string")],
//           type.generic("Promise", [type.generic("T")])
//         ),
//         save: type.function(
//           [type.primitive("T")],
//           type.generic("Promise", [type.primitive("void")])
//         )
//       },
//       ["T"]
//     )
//
//     yield* val.let(
//       "point",
//       val.object({
//         x: val.number(10),
//         y: val.number(20)
//       }),
//       type.generic("Point", [type.primitive("number")])
//     )
//
//     yield* val.let(
//       "lol",
//       val.fn(
//         [
//           { name: "items", type: type.array(type.primitive("T")) },
//           {
//             name: "predicate",
//             type: type.function([type.primitive("T")], type.primitive("boolean"))
//           }
//         ],
//         function* () {
//           return val.array([])
//         },
//         type.array(type.primitive("T")),
//         ["T"]
//       )
//     )
//
//     yield* val.number(2)
//   })
// })

// const cw2 = CodeWriter(function* () {
//   yield* val.block(function* () {
//     yield* val.let("x", true)
//     yield* val.let("y", false)
//     yield* val.let(
//       "user",
//       val.object({
//         name: "sai",
//         age: 2,
//         isPerson: val.bool(true),
//         isReal: true
//       })
//     )
//     yield* val.let("items", val.array([1, "hello", val.string("world"), true]))
//
//     yield* val.let(
//       "add",
//       val.fn(
//         [
//           { name: "a", type: type.primitive("number") },
//           { name: "b", type: type.primitive("number") }
//         ],
//         function* (vars) {
//           return numeric.add(vars.a, vars.b)
//         },
//         type.primitive("number")
//       )
//     )
//
//     yield* val.let("result1", val.call("add", [5, 3]))
//     let mathRef = val.let('mathRef', 2)
//     yield* val.let("result2", val.call(val.prop(mathRef, "max"), [10, 20, 5]))
//
//     yield* val.methodCall("console", "log", ["Hello from method call!"])
//     const itemsRef = new VarRef("items")
//     yield* val.methodCall(itemsRef, "push", [42])
//     yield* val.methodCall("user", "toString", [])
//
//     yield* val.if(
//       true,
//       val.block(function* () {
//         yield* val.methodCall("console", "log", ["Hello World!"])
//       }),
//       val.block(function* () {
//         yield* val.methodCall("console", "log", ["Goodbye!"])
//       })
//     )
//   })
// })

// console.log(cw2.run())

const someFn = CodeWriter(function* () {
  yield* val.let(
    "complexFunction",
    val.fn(
      [
        { name: "items", type: type.array(type.primitive("number")) },
        { name: "threshold", type: type.primitive("number") }
      ],
      val.fnBlock(function* (args) {
        let result = yield* val.let("result", val.array([]))
        yield* val.if(
          numeric.gt(args.items, args.threshold),
          val.block(function* () {
            yield* val.methodCall("result", "push", [args.items])
          }),
          val.block(function* () {
            // skip item
          })
        )
        return new VarRef("result")
      }),
      type.array(type.primitive("number"))
    )
  )
})

console.log("\n" + "=".repeat(50) + "\n")
console.log(someFn.run())

// const loopExamples = CodeWriter(function* () {
//   yield* val.block(function* () {
//     // For-of loop
//     yield* val.forOf("item", "items", function* (item: VarRef<string>) {
//       yield* val.methodCall("console", "log", [item])
//       yield* val.if(
//         numeric.gt(item, 5),
//         val.block(function* () {
//           yield* new RawExpr("continue")
//         }),
//         val.block(function* () {
//           // process item
//         })
//       )
//     })
//
//     yield* val.nl()
//
//     // For-in loop
//     yield* val.forIn("key", "obj", function* (key) {
//       const objRef = new VarRef("obj")
//       yield* val.methodCall("console", "log", [val.add(val.add(key, ": "), val.index(objRef, key))])
//     })
//
//     yield* val.nl()
//
//     // Traditional for loop
//     const iRef = new VarRef("i")
//     yield* val.for(new RawExpr("let i = 0"), "i < 10", val.increment(iRef, false), function* () {
//       yield* val.methodCall("console", "log", [iRef])
//       yield* val.if(
//         val.strictEq(iRef, 5),
//         val.block(function* () {
//           yield* new RawExpr("break")
//         }),
//         val.block(function* () {
//           // continue
//         })
//       )
//     })
//
//     yield* val.nl()
//
//     let count = yield* val.let("count", 0)
//     yield* val.while(val.lt(count, 3), function* () {
//       yield* val.methodCall("console", "log", [val.template(["Count: ", ""], count)])
//       val.increment(count, false)
//     })
//
//     yield* val.nl()
//
//     // Nested loops
//     yield* val.forOf("row", "matrix", function* () {
//       yield* val.forOf("cell", "row", function* () {
//         yield* val.methodCall("console", "log", ["cell"])
//       })
//     })
//   })
// })

// console.log(loopExamples.run())

// const typeSafeExample = CodeWriter(function* () {
//   yield* val.block(function* () {
//     const user = yield* val.let(
//       "user",
//       val.object({
//         name: "Alice",
//         age: 30
//       })
//     )
//
//     const items = yield* val.let("items", [1, 2, 3, 4, 5])
//
//     yield* val.methodCall(user, "toString", [])
//     yield* val.methodCall("console", "log", [user])
//
//     yield* val.forOf("item", items, function* (item) {
//       yield* val.methodCall("console", "log", [item])
//       yield* val.if(
//         val.gt(item, 3),
//         val.block(function* () {
//           yield* val.methodCall("console", "log", ["Item is greater than 3"])
//         }),
//         val.block(function* () {
//           yield* val.methodCall("console", "log", ["Item is 3 or less"])
//         })
//       )
//     })
//
//     const processUser = yield* val.let(
//       "processUser",
//       val.fn(
//         [
//           { name: "userParam", type: type.primitive("any") },
//           { name: "multiplier", type: type.primitive("number") }
//         ],
//         function* (args) {
//           yield* val.methodCall("console", "log", [args.userParam])
//           const result = yield* val.let(
//             "result",
//             val.multiply(val.prop(args.userParam, "age"), args.multiplier)
//           )
//           return result
//         },
//         type.primitive("number")
//       )
//     )
//
//     yield* val.call(processUser, [user, 2])
//   })
// })

const operationsExample = CodeWriter(function* () {
  yield* val.block(function* () {
    const a = yield* val.let("a", 10)
    const b = yield* val.let("b", 5)
    const user = yield* val.let("user", { name: "Alice", age: 30 })

    const sum = yield* val.let("sum", numeric.add(a, 2))

    yield* val.if(
      numeric.gt(a, b),
      val.block(function* () {
        yield* val.methodCall("console", "log", ["a is greater than b"])
      }),
      val.block(function* () {
        yield* val.methodCall("console", "log", ["a is not greater than b"])
      })
    )

    const adfas = val.prop(user, "age")
    const age = yield* val.let("age", val.prop(user, "age"))

    const doubleAge = yield* val.let("doubleAge", numeric.multiply(val.prop(user, "age"), 2))

    const greeting = yield* val.let(
      "greeting",
      val.template(["Hello ", "!"], val.prop(user, "name"))
    )

    yield* val.methodCall("console", "log", [greeting])
  })
})

console.log("hi")
console.log(operationsExample.run())
