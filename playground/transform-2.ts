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
      const codeBlock = t.blockStatement([
        t.variableDeclaration("const", [
          t.variableDeclarator(t.identifier("a"), t.numericLiteral(10)),
          t.variableDeclarator(
            t.identifier("b"),
            t.binaryExpression("+", t.numericLiteral(5), t.identifier("a"))
          ),
          t.variableDeclarator(
            t.identifier("user"),
            t.objectExpression([
              t.objectProperty(t.identifier("name"), t.stringLiteral("sai")),
              t.objectProperty(t.identifier("age"), t.numericLiteral(23423)),
              t.objectProperty(t.identifier("count"), t.numericLiteral(2342))
            ])
          ),
          t.variableDeclarator(
            t.identifier("haha"),
            t.memberExpression(t.identifier("user"), t.identifier("age"))
          ),
          t.variableDeclarator(
            t.identifier("sum"),
            t.binaryExpression(
              "+",
              t.identifier("a"),
              t.memberExpression(t.identifier("user"), t.identifier("age"))
            )
          ),
          t.variableDeclarator(
            t.identifier("result1"),
            t.binaryExpression(
              "+",
              t.identifier("a"),
              t.memberExpression(t.identifier("user"), t.identifier("age"))
            )
          ),
          t.variableDeclarator(
            t.identifier("result3"),
            t.binaryExpression(
              "+",
              t.identifier("a"),
              t.memberExpression(t.identifier("user"), t.identifier("count"))
            )
          )
        ])
      ])

      path.node.body.body.unshift(...codeBlock.body)
    }
  }
})

const output = generate(ast, {}, code)

console.log(output.code)
