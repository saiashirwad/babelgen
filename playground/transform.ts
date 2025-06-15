import * as t from "@babel/types"
import { parse } from "@babel/parser"
import traverse from "@babel/traverse"
import generate from "@babel/generator"
import * as fs from "fs"
import { $, numeric } from ".."

const code = fs.readFileSync("playground/code.ts", "utf-8")

const ast = parse(code, {
  sourceType: "module",
  plugins: ["typescript"]
})

traverse(ast, {
  FunctionDeclaration(path) {
    const functionName = path.node.id?.name
    if (functionName) {
      const codeBlock = $.block(function* () {
        const a = yield* $.let("a", 10)
        const b = yield* $.let("b", numeric.add(5, a))
        const user = yield* $.let("user", { name: "sai", age: 23423, count: 2342 })

        const haha = yield* $.let("haha", $.prop(user, "age"))
        const sum = yield* $.let("sum", numeric.add(a, $.prop(user, "age")))

        const result1 = yield* $.let("result1", numeric.add(a, $.prop(user, "name")))
        const result3 = yield* $.let("result1", numeric.add(a, $.prop(user, "count")))
      }).toBabelAST()

      path.node.body.body.unshift(...codeBlock.body)
    }
  }
})

const output = generate(ast, {}, code)

console.log(output.code)
