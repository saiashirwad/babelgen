import * as t from "@babel/types"
import { generate } from "@babel/generator"

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

export abstract class BaseExpr {
  abstract toString(): string
  abstract toBabelAST(): t.Node
}

export class BlockExpr extends BaseExpr {
  constructor(public block: () => Generator<ValueExpr>) {
    super()
  }

  toBabelAST(): t.BlockStatement {
    const statements: t.Statement[] = []

    for (const expr of this.block()) {
      if (expr instanceof BaseExpr) {
        const node = expr.toBabelAST()
        // Convert expressions to expression statements if needed
        if (t.isExpression(node)) {
          statements.push(t.expressionStatement(node))
        } else if (t.isStatement(node)) {
          statements.push(node)
        }
      }
    }

    return t.blockStatement(statements)
  }

  *[Symbol.iterator](): Generator<this, any> {
    yield this
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

export class VarRef<const Type> extends BaseExpr {
  declare readonly __type: Type
  constructor(
    public name: string,
    public type?: BaseType
  ) {
    super()
  }

  toBabelAST(): t.Identifier {
    return t.identifier(this.name)
  }

  *[Symbol.iterator](): Generator<this, any> {
    yield this
  }

  toString(): string {
    return this.name
  }
}

export class NumberExpr extends BaseExpr {
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

  toBabelAST(): t.NumericLiteral {
    return t.numericLiteral(this.value)
  }

  *[Symbol.iterator]() {
    return this
  }
}

export class StringExpr extends BaseExpr {
  constructor(
    public value: string,
    public type?: BaseType
  ) {
    super()
  }

  toBabelAST(): t.StringLiteral {
    return t.stringLiteral(this.value)
  }

  *[Symbol.iterator](): Generator<this, any> {
    yield this
  }

  toString(): string {
    const typeAnnotation = this.type ? `: ${this.type.toString()}` : ""
    return JSON.stringify(this.value) + typeAnnotation
  }
}

export class BoolExpr extends BaseExpr {
  constructor(
    public value: boolean,
    public type?: BaseType
  ) {
    super()
  }

  toBabelAST(): t.BooleanLiteral {
    return t.booleanLiteral(this.value)
  }

  *[Symbol.iterator](): Generator<this, any> {
    yield this
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

export class LetExpr<const Value extends ValueExpr> extends BaseExpr {
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

  toBabelAST(): t.VariableDeclaration {
    return t.variableDeclaration("const", [
      t.variableDeclarator(t.identifier(this.name), this.convertValueToBabel(this.value))
    ])
  }

  private convertValueToBabel(value: ValueExpr): t.Expression {
    if (value instanceof BaseExpr) {
      return value.toBabelAST() as t.Expression
    }
    if (typeof value === "number") {
      return t.numericLiteral(value)
    }
    if (typeof value === "string") {
      return t.stringLiteral(value)
    }
    if (typeof value === "boolean") {
      return t.booleanLiteral(value)
    }
    if (typeof value === "object" && value !== null) {
      return this.objectToBabel(value)
    }
    throw new Error(`Unsupported value type: ${typeof value}`)
  }

  private objectToBabel(obj: Record<string, any>): t.ObjectExpression {
    const properties = Object.entries(obj).map(([key, val]) =>
      t.objectProperty(t.identifier(key), this.convertValueToBabel(val))
    )
    return t.objectExpression(properties)
  }

  *[Symbol.iterator](): Generator<this, VarRef<LetInfer<Value>>, unknown> {
    // @ts-ignore
    yield this
    return new VarRef<LetInfer<Value>>(this.name, this.type)
  }
}

export class IfExpr extends BaseExpr {
  constructor(
    public condition: ValueExpr,
    public thenBranch: BlockExpr,
    public elseBranch: BlockExpr
  ) {
    super()
  }

  *[Symbol.iterator](): Generator<this, any> {
    yield this
  }

  toBabelAST(): t.IfStatement {
    const test = this.convertValueToBabel(this.condition)
    const consequent = this.thenBranch.toBabelAST() as t.BlockStatement
    const alternate = this.elseBranch.toBabelAST() as t.BlockStatement

    return t.ifStatement(test, consequent, alternate)
  }

  private convertValueToBabel(value: ValueExpr): t.Expression {
    if (value instanceof BaseExpr) {
      return value.toBabelAST() as t.Expression
    }
    if (typeof value === "boolean") return t.booleanLiteral(value)
    if (typeof value === "number") return t.numericLiteral(value)
    if (typeof value === "string") return t.stringLiteral(value)
    throw new Error(`Unsupported condition type: ${typeof value}`)
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

export class ForExpr extends BaseExpr {
  constructor(
    public init: ValueExpr | undefined,
    public variable: string,
    public iterable: ValueExpr,
    public body: (loopVar: VarRef<any>) => Generator<ValueExpr>,
    public type: "for-of" | "for-in" | "for" = "for-of"
  ) {
    super()
  }

  *[Symbol.iterator](): Generator<this, any> {
    yield this
  }

  toBabelAST(): t.ForStatement | t.ForOfStatement | t.ForInStatement {
    if (this.type === "for-of") {
      const left = t.variableDeclaration("const", [
        t.variableDeclarator(t.identifier(this.variable))
      ])
      const right = this.convertValueToBabel(this.iterable)
      const body = this.generateLoopBody()
      return t.forOfStatement(left, right, body)
    } else if (this.type === "for-in") {
      const left = t.variableDeclaration("const", [
        t.variableDeclarator(t.identifier(this.variable))
      ])
      const right = this.convertValueToBabel(this.iterable)
      const body = this.generateLoopBody()
      return t.forInStatement(left, right, body)
    } else {
      // Traditional for loop
      const init = this.init ? this.convertValueToBabel(this.init) : null
      const test = t.identifier(this.variable) // reusing variable for condition
      const update = this.convertValueToBabel(this.iterable) as t.Expression
      const body = this.generateLoopBody()
      return t.forStatement(init, test, update, body)
    }
  }

  private convertValueToBabel(value: ValueExpr): t.Expression {
    if (value instanceof BaseExpr) {
      return value.toBabelAST() as t.Expression
    }
    if (typeof value === "string") return t.stringLiteral(value)
    if (typeof value === "number") return t.numericLiteral(value)
    if (typeof value === "boolean") return t.booleanLiteral(value)
    throw new Error(`Unsupported value type: ${typeof value}`)
  }

  private generateLoopBody(): t.BlockStatement {
    const statements: t.Statement[] = []
    const loopVar = new VarRef(this.variable)

    for (const expr of this.body(loopVar)) {
      if (expr instanceof BaseExpr) {
        const node = expr.toBabelAST()
        if (t.isStatement(node)) {
          statements.push(node)
        } else if (t.isExpression(node)) {
          statements.push(t.expressionStatement(node))
        }
      }
    }

    return t.blockStatement(statements)
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

export class WhileExpr extends BaseExpr {
  constructor(
    public condition: ValueExpr,
    public body: () => Generator<ValueExpr>
  ) {
    super()
  }

  toBabelAST(): t.WhileStatement {
    const test = this.convertValueToBabel(this.condition)
    const statements: t.Statement[] = []

    for (const expr of this.body()) {
      if (expr instanceof BaseExpr) {
        const node = expr.toBabelAST()
        if (t.isStatement(node)) {
          statements.push(node)
        } else if (t.isExpression(node)) {
          statements.push(t.expressionStatement(node))
        }
      }
    }

    const body = t.blockStatement(statements)
    return t.whileStatement(test, body)
  }

  private convertValueToBabel(value: ValueExpr): t.Expression {
    if (value instanceof BaseExpr) {
      return value.toBabelAST() as t.Expression
    }
    if (typeof value === "boolean") return t.booleanLiteral(value)
    if (typeof value === "number") return t.numericLiteral(value)
    if (typeof value === "string") return t.stringLiteral(value)
    throw new Error(`Unsupported condition type: ${typeof value}`)
  }

  *[Symbol.iterator](): Generator<this, any> {
    yield this
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

export class ObjectExpr extends BaseExpr {
  constructor(
    public properties: Record<string, ValueExpr>,
    public type?: BaseType
  ) {
    super()
  }

  *[Symbol.iterator](): Generator<this, any> {
    yield this
  }

  toBabelAST(): t.ObjectExpression {
    const props = Object.entries(this.properties).map(([key, value]) => {
      const valueNode = this.convertValueToBabel(value)
      return t.objectProperty(t.identifier(key), valueNode)
    })
    return t.objectExpression(props)
  }

  private convertValueToBabel(value: ValueExpr): t.Expression {
    if (value instanceof BaseExpr) {
      return value.toBabelAST() as t.Expression
    }
    if (typeof value === "number") return t.numericLiteral(value)
    if (typeof value === "string") return t.stringLiteral(value)
    if (typeof value === "boolean") return t.booleanLiteral(value)
    throw new Error(`Unsupported value type: ${typeof value}`)
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

export class ArrayExpr extends BaseExpr {
  constructor(
    public elements: ValueExpr[],
    public type?: BaseType
  ) {
    super()
  }

  *[Symbol.iterator](): Generator<this, any> {
    yield this
  }

  toBabelAST(): t.ArrayExpression {
    const elements = this.elements.map(element => {
      if (element instanceof BaseExpr) {
        return element.toBabelAST() as t.Expression
      }
      if (typeof element === "number") return t.numericLiteral(element)
      if (typeof element === "string") return t.stringLiteral(element)
      if (typeof element === "boolean") return t.booleanLiteral(element)
      throw new Error(`Unsupported element type: ${typeof element}`)
    })
    return t.arrayExpression(elements)
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

export class FunctionExpr extends BaseExpr {
  constructor(
    public params: Array<{ name: string; type?: BaseType }>,
    public body: (args: Record<string, VarRef<any>>) => Generator<ValueExpr, ValueExpr>,
    public returnType?: BaseType,
    public typeParams?: string[]
  ) {
    super()
  }

  *[Symbol.iterator](): Generator<this, any> {
    yield this
  }

  toBabelAST(): t.ArrowFunctionExpression {
    const params = this.params.map(param => t.identifier(param.name))

    // Generate function body
    const statements: t.Statement[] = []
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
      if (expr instanceof BaseExpr) {
        const node = expr.toBabelAST()
        if (t.isStatement(node)) {
          statements.push(node)
        } else if (t.isExpression(node)) {
          statements.push(t.expressionStatement(node))
        }
      }
      result = generator.next()
    }

    // Handle return value
    if (result.value !== undefined) {
      const returnExpr = result.value
      if (returnExpr instanceof BaseExpr) {
        statements.push(t.returnStatement(returnExpr.toBabelAST() as t.Expression))
      } else {
        statements.push(t.returnStatement(this.convertValueToBabel(returnExpr)))
      }
    }

    const body = t.blockStatement(statements)
    return t.arrowFunctionExpression(params, body)
  }

  private convertValueToBabel(value: ValueExpr): t.Expression {
    if (typeof value === "string") return t.stringLiteral(value)
    if (typeof value === "number") return t.numericLiteral(value)
    if (typeof value === "boolean") return t.booleanLiteral(value)
    throw new Error(`Unsupported value type: ${typeof value}`)
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

export class TypeAliasExpr extends BaseExpr {
  constructor(
    public name: string,
    public type: BaseType,
    public typeParams?: string[]
  ) {
    super()
  }

  toBabelAST(): t.TSTypeAliasDeclaration {
    // Note: This generates TypeScript-specific AST nodes
    const typeAnnotation = this.convertTypeToTSType(this.type)
    const typeParameters =
      this.typeParams?.map(param => t.tsTypeParameter(null, null, param)) || null

    return t.tsTypeAliasDeclaration(
      t.identifier(this.name),
      typeParameters ? t.tsTypeParameterDeclaration(typeParameters) : null,
      typeAnnotation
    )
  }

  private convertTypeToTSType(type: BaseType): t.TSType {
    if (type instanceof PrimitiveType) {
      switch (type.name) {
        case "string":
          return t.tsStringKeyword()
        case "number":
          return t.tsNumberKeyword()
        case "boolean":
          return t.tsBooleanKeyword()
        case "any":
          return t.tsAnyKeyword()
        default:
          return t.tsTypeReference(t.identifier(type.name))
      }
    }
    // Add more type conversions as needed
    return t.tsAnyKeyword()
  }

  toString(): string {
    const typeParamsStr = this.typeParams?.length ? `<${this.typeParams.join(", ")}>` : ""
    return `type ${this.name}${typeParamsStr} = ${this.type.toString()};\n`
  }

  *[Symbol.iterator](): Generator<this, any> {
    yield this
  }
}

export class InterfaceExpr extends BaseExpr {
  constructor(
    public name: string,
    public properties: Record<string, BaseType>,
    public typeParams?: string[]
  ) {
    super()
  }

  *[Symbol.iterator](): Generator<this, any> {
    yield this
  }

  toBabelAST(): t.TSInterfaceDeclaration {
    const properties = Object.entries(this.properties).map(([key, type]) => {
      const typeAnnotation = this.convertTypeToTSType(type)
      return t.tsPropertySignature(t.identifier(key), t.tsTypeAnnotation(typeAnnotation))
    })

    const typeParameters =
      this.typeParams?.map(param => t.tsTypeParameter(null, null, param)) || null

    return t.tsInterfaceDeclaration(
      t.identifier(this.name),
      typeParameters ? t.tsTypeParameterDeclaration(typeParameters) : null,
      null,
      t.tsInterfaceBody(properties)
    )
  }

  private convertTypeToTSType(type: BaseType): t.TSType {
    if (type instanceof PrimitiveType) {
      switch (type.name) {
        case "string":
          return t.tsStringKeyword()
        case "number":
          return t.tsNumberKeyword()
        case "boolean":
          return t.tsBooleanKeyword()
        case "any":
          return t.tsAnyKeyword()
        default:
          return t.tsTypeReference(t.identifier(type.name))
      }
    }
    return t.tsAnyKeyword()
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

export class FunctionCallExpr extends BaseExpr {
  constructor(
    public functionRef: ValueExpr,
    public args: ValueExpr[]
  ) {
    super()
  }

  toBabelAST(): t.CallExpression {
    const callee = this.convertValueToBabel(this.functionRef)
    const args = this.args.map(arg => this.convertValueToBabel(arg))

    return t.callExpression(callee, args)
  }

  private convertValueToBabel(value: ValueExpr): t.Expression {
    if (value instanceof BaseExpr) {
      return value.toBabelAST() as t.Expression
    }
    if (typeof value === "string") return t.stringLiteral(value)
    if (typeof value === "number") return t.numericLiteral(value)
    if (typeof value === "boolean") return t.booleanLiteral(value)
    throw new Error(`Unsupported value type: ${typeof value}`)
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

export class MethodCallExpr extends BaseExpr {
  constructor(
    public object: ValueExpr,
    public method: string,
    public args: ValueExpr[]
  ) {
    super()
  }

  toBabelAST(): t.CallExpression {
    const objectNode = this.convertValueToBabel(this.object)
    const property = t.identifier(this.method)
    const callee = t.memberExpression(objectNode, property)
    const args = this.args.map(arg => this.convertValueToBabel(arg))

    return t.callExpression(callee, args)
  }

  private convertValueToBabel(value: ValueExpr): t.Expression {
    if (value instanceof BaseExpr) {
      return value.toBabelAST() as t.Expression
    }
    if (typeof value === "string") return t.stringLiteral(value)
    if (typeof value === "number") return t.numericLiteral(value)
    if (typeof value === "boolean") return t.booleanLiteral(value)
    throw new Error(`Unsupported value type: ${typeof value}`)
  }

  *[Symbol.iterator](): Generator<this, any> {
    yield this
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

export class RawExpr extends BaseExpr {
  constructor(public code: string) {
    super()
  }

  toBabelAST(): t.Node {
    // We should probably use @babel/parser
    try {
      const parsed = require("@babel/parser").parse(this.code, {
        sourceType: "module",
        plugins: ["typescript"]
      })
      return parsed.body[0] || t.expressionStatement(t.stringLiteral(this.code))
    } catch {
      // Fallback to string literal if parsing fails
      return t.expressionStatement(t.stringLiteral(this.code))
    }
  }

  toString(): string {
    return this.code
  }
}

export class NumericBinaryOpExpr extends BaseExpr {
  constructor(
    public left: VarRefOrType<number>,
    public operator: string,
    public right: VarRefOrType<number>
  ) {
    super()
  }

  toBabelAST(): t.BinaryExpression {
    const leftNode = this.convertValueToBabel(this.left)
    const rightNode = this.convertValueToBabel(this.right)

    return t.binaryExpression(this.operator as t.BinaryExpression["operator"], leftNode, rightNode)
  }

  private convertValueToBabel(value: VarRefOrType<number>): t.Expression {
    if (value instanceof BaseExpr) {
      return value.toBabelAST() as t.Expression
    }
    if (typeof value === "number") {
      return t.numericLiteral(value)
    }
    throw new Error(`Unsupported numeric operand: ${typeof value}`)
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

export class LogicalBinaryOpExpr extends BaseExpr {
  constructor(
    public left: VarRefOrType<boolean>,
    public operator: string,
    public right: VarRefOrType<boolean>
  ) {
    super()
  }

  toBabelAST(): t.LogicalExpression {
    const left = this.convertValueToBabel(this.left)
    const right = this.convertValueToBabel(this.right)

    return t.logicalExpression(this.operator as t.LogicalExpression["operator"], left, right)
  }

  private convertValueToBabel(value: VarRefOrType<boolean>): t.Expression {
    if (value instanceof BaseExpr) {
      return value.toBabelAST() as t.Expression
    }
    if (typeof value === "boolean") return t.booleanLiteral(value)
    throw new Error(`Unsupported boolean operand: ${typeof value}`)
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

type UnaryOperators = "void" | "throw" | "delete" | "!" | "+" | "-" | "~" | "typeof"
export class UnaryOpExpr extends BaseExpr {
  constructor(
    public operator: string,
    public operand: ValueExpr,
    public prefix: boolean = true
  ) {
    super()
  }

  toBabelAST(): t.UnaryExpression | t.UpdateExpression {
    const argument = this.convertValueToBabel(this.operand)

    if (this.operator === "++" || this.operator === "--") {
      return t.updateExpression(this.operator, argument, this.prefix)
    } else {
      // @ts-expect-error this is cool
      return t.unaryExpression(this.operator, argument, this.prefix)
    }
  }

  private convertValueToBabel(value: ValueExpr): t.Expression {
    if (value instanceof BaseExpr) {
      return value.toBabelAST() as t.Expression
    }
    if (typeof value === "string") return t.stringLiteral(value)
    if (typeof value === "number") return t.numericLiteral(value)
    if (typeof value === "boolean") return t.booleanLiteral(value)
    throw new Error(`Unsupported operand type: ${typeof value}`)
  }

  toString(): string {
    const operandStr =
      this.operand instanceof BaseExpr ? this.operand.toString() : JSON.stringify(this.operand)
    return this.prefix ? `${this.operator}${operandStr}` : `${operandStr}${this.operator}`
  }
}

type VarRefInner<T> = T extends VarRef<infer U> ? U : never

export class PropertyAccessExpr<
  const Value extends VarRef<any>,
  const Property extends keyof VarRefInner<Value>,
  const PropertyType = VarRefInner<Value>[Property]
> extends BaseExpr {
  declare readonly __type: PropertyType
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

  toBabelAST(): t.MemberExpression {
    const objectNode = this.object.toBabelAST() as t.Expression

    if (this.computed) {
      const propertyNode =
        typeof this.property === "string" ?
          t.stringLiteral(this.property)
        : t.identifier(String(this.property))
      return t.memberExpression(objectNode, propertyNode, true)
    } else {
      return t.memberExpression(objectNode, t.identifier(String(this.property)), false)
    }
  }

  *[Symbol.iterator]() {
    // yield this
    return new VarRef<PropertyType>("hi", type.primitive("any"))
  }
}

export class TemplateLiteralExpr extends BaseExpr {
  constructor(
    public parts: string[],
    public expressions: ValueExpr[]
  ) {
    super()
  }

  toBabelAST(): t.TemplateLiteral {
    const quasis = this.parts.map((part, index) =>
      t.templateElement({ raw: part, cooked: part }, index === this.parts.length - 1)
    )

    const expressions = this.expressions.map(expr => {
      if (expr instanceof BaseExpr) {
        return expr.toBabelAST() as t.Expression
      }
      if (typeof expr === "string") return t.stringLiteral(expr)
      if (typeof expr === "number") return t.numericLiteral(expr)
      if (typeof expr === "boolean") return t.booleanLiteral(expr)
      throw new Error(`Unsupported template expression: ${typeof expr}`)
    })

    return t.templateLiteral(quasis, expressions)
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

export type Primitive = number | string | boolean | symbol | Record<string, any>
export type ValueExpr = Expr | Primitive
export type FunctionBody = () => Generator<ValueExpr, ValueExpr>

export type VarRefOrType<T> = VarRef<T> | T | PropertyAccessExpr<VarRef<any>, any, T>
// type VarRefOrType<T> = VarRef<number> | number | PropertyAccessExpr<VarRef<any>, any, number>
export type asdf = VarRefOrType<string>

type CodeWriter = {
  run: () => string
}

export function CodeGen<const Y>(write: () => Generator<Y, void>): CodeWriter {
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

export function CodeGenAST<const Y>(write: () => Generator<Y, void>): { run: () => t.Program } {
  return {
    run: () => {
      const body: t.Statement[] = []

      for (const value of write()) {
        if (value instanceof BaseExpr) {
          const node = value.toBabelAST()
          if (t.isStatement(node)) {
            body.push(node)
          } else if (t.isExpression(node)) {
            body.push(t.expressionStatement(node))
          }
        }
      }

      return t.program(body, [], "module")
    }
  }
}

export type NumericBinaryOpParam = VarRefOrType<number>
export type LogicalBinaryOpParam = VarRefOrType<boolean>

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

export const $ = {
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

  prop: <
    const Value extends VarRef<Record<any, any>>,
    Property extends keyof VarRefInner<Value>,
    const PropertyType = VarRefInner<Value>[Property]
  >(
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

const someFn = CodeGenAST(function* () {
  yield* $.let(
    "complexFunction",
    $.fn(
      [
        { name: "items", type: type.array(type.primitive("number")) },
        { name: "threshold", type: type.primitive("number") }
      ],
      $.fnBlock(function* (args) {
        let result = yield* $.let("result", $.array([]))
        yield* $.if(
          numeric.gt(args.items, args.threshold),
          $.block(function* () {
            yield* $.methodCall("result", "push", [args.items])
          }),
          $.block(function* () {
            // skip item
          })
        )
        return new VarRef("result")
      }),
      type.array(type.primitive("number"))
    )
  )
})

// console.log(generate(someFn.run()).map)

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

const operationsExample = CodeGenAST(function* () {
  yield* $.block(function* () {
    const a = yield* $.let("a", 10)
    const b = yield* $.let("b", numeric.add(5, a))
    const user = yield* $.let("user", { name: "sai", age: 23423, count: 2342 })

    const haha = yield* $.let("haha", $.prop(user, "age"))
    const sum = yield* $.let("sum", numeric.add(a, $.prop(user, "age")))

    const result1 = yield* $.let("result1", numeric.add(a, $.prop(user, "age")))
    const result3 = yield* $.let("result1", numeric.add(a, $.prop(user, "count")))

    // yield* $.if(
    //   numeric.gt(a, $.prop(user, "name")),
    //   $.block(function* () {
    //     yield* $.methodCall("console", "log", ["a is greater than b"])
    //   }),
    //   $.block(function* () {
    //     yield* $.methodCall("console", "log", ["a is not greater than b"])
    //   })
    // )
  })
})
