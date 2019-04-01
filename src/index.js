import fs from 'fs'
import fse from 'fs-extra'
import {
  join, resolve, relative, extname,
} from 'path'
import getTextId from './getTextId'
import getOptions from './getOptions'
import getDetector from './getDetector'

const idCache = {}
const fileMap = {}
const textMap = {} // { text: id }
let detectFn = null
let i18nMethodName = null

function init(opts) {
  if (!detectFn) {
    const options = getOptions(opts)
    const { dest, filename } = options
    const filepath = resolve(process.cwd(), dest, filename)

    if (fs.existsSync(filepath)) {
      try {
        const raw = fs.readFileSync(filepath)
        const arr = JSON.parse(raw) || []

        arr.forEach((item) => {
          textMap[item.defaultMessage] = item
        })
      } catch (ex) {
        // pass
      }
    }

    // init detect function
    detectFn = getDetector(options)
  }
}

function report(path, text) {
  const { node } = path
  const { line, column } = node.loc.start
  const { filename } = path.hub.file.opts
  const filepath = relative(process.cwd(), filename)
  const loc = `${filepath}#${line}#${column}`
  const cache = textMap[text]

  if (cache) {
    if (!cache.loc.includes(loc)) {
      cache.loc.push(loc)
    }
  } else {
    textMap[text] = {
      id: idCache[text] || getTextId(text),
      text,
      loc: [loc],
    }
  }

  const { id } = textMap[text]
  const item = {
    id, text, line, column,
  }
  const key = `${id}#${text}#${line}#${column}`
  const fileCache = fileMap[filename]
  if (!fileCache) {
    fileMap[filename] = { [key]: item }
  } else if (!fileCache[key]) {
    fileCache[key] = item
  }

  // console.log(`${text}#${loc}`)

  return id
}

function clean(filename) {
  const filepath = relative(process.cwd(), filename)
  Object.keys(idCache).forEach((text) => { delete idCache[text] })
  Object.keys(textMap).forEach((text) => {
    const { id, loc } = textMap[text]
    const exist = loc.some(str => str.indexOf(filepath) === 0)
    if (exist) {
      const len = loc.length
      if (len > 1) {
        for (let i = len - 1; i >= 0; i -= 1) {
          const str = loc[i]
          if (str.indexOf(filepath) === 0) {
            loc.splice(i, 1)
          }
        }
      }

      if (len === 1 || loc.length === 0) {
        delete textMap[text]
        idCache[text] = id
      }
    }
  })

  delete fileMap[filename]
}

function detectAndReport(path, text) {
  const { filename } = path.hub.file.opts
  if (detectFn(text, filename)) {
    return report(path, text)
  }

  return 0
}

function writeFile(dist, content) {
  fse.ensureFileSync(dist)
  fs.writeFileSync(dist, JSON.stringify(content, null, 2))
}

export default function ({ types: t }) {
  return {
    visitor: {
      Program: {
        enter(path, { opts }) {
          const { filename } = path.hub.file.opts
          init(opts)
          clean(filename)
          i18nMethodName = path.scope.generateUidIdentifier('i18n').name
        },

        exit(path, { opts }) {
          const { filename } = path.hub.file.opts
          const fileCache = fileMap[filename]
          if (fileCache) {
            path.node.body.unshift(
              t.importDeclaration(
                [
                  t.ImportSpecifier(
                    t.identifier(i18nMethodName),
                    t.identifier('i18n'),
                  ),
                ],
                t.stringLiteral('mickey-i18n'),
              ),
            )

            // rollup
            const options = getOptions(opts)
            const dir = resolve(process.cwd(), options.dest)
            const dist = join(dir, options.filename)
            const allText = Object.keys(textMap).map(key => textMap[key])
            writeFile(dist, allText)

            // file item
            if (options.debug) {
              const sourcePath = relative(process.cwd(), filename)
              const targetPath = join(dir, sourcePath.replace(extname(sourcePath), '.json'))
              const fileText = Object.keys(fileCache).map(key => fileCache[key]).sort((a, b) => (
                a.line === b.line
                  ? a.column - b.column
                  : a.line - b.line
              )).map(item => ({
                id: item.id,
                text: item.text,
                loc: `${item.line}#${item.column}`,
              }))

              writeFile(targetPath, fileText)
            }
          }
        },
      },

      StringLiteral(path) {
        const { node } = path
        const text = node.value.trim()

        if (node.loc && detectAndReport(path, text)) {
          const item = textMap[text]
          const i18nKey = String(item && item.id)
          const parentNode = path.parentPath.node

          if (t.isJSXAttribute(parentNode)) {
            path.replaceWith(
              t.JSXExpressionContainer(
                t.CallExpression(
                  t.Identifier(i18nMethodName),
                  [
                    t.stringLiteral(i18nKey),
                    t.stringLiteral(text),
                  ],
                ),
              ),
            )
          } else if (t.isArrayExpression(parentNode)
            || t.isObjectProperty(parentNode)
            || t.isAssignmentExpression(parentNode)
            || t.isVariableDeclarator(parentNode)
            || t.isBinaryExpression(parentNode)
            || t.isLogicalExpression(parentNode)
            || t.isNewExpression(parentNode)
            || t.isCallExpression(parentNode)
          ) {
            path.replaceWith(
              t.CallExpression(
                t.Identifier(i18nMethodName),
                [
                  t.stringLiteral(i18nKey),
                  t.stringLiteral(text),
                ],
              ),
            )
          }
        }
      },

      JSXText(path) {
        const { node } = path
        const text = node.value.trim()
        if (text && detectAndReport(path, text)) {
          const item = textMap[text]
          const i18nKey = String(item && item.id)

          path.replaceWith(
            t.JSXExpressionContainer(
              t.CallExpression(
                t.Identifier(i18nMethodName),
                [
                  t.stringLiteral(i18nKey),
                  t.stringLiteral(text),
                ],
              ),
            ),
          )
        }
      },

      TemplateLiteral(path) {
        const { node } = path
        const { filename } = path.hub.file.opts
        const exist = node.quasis.some(item => detectFn(item.value.raw, filename))

        if (exist) {
          const arr = [
            ...node.expressions,
            ...node.quasis,
          ].sort((a, b) => {
            const sub = a.loc.start.line - b.loc.start.line
            if (sub === 0) {
              return a.loc.start.column - b.loc.start.column
            }
            return sub
          })

          let index = 0
          const raw = arr.map((item) => {
            if (t.isTemplateElement(item)) {
              return item.value.raw
            }
            const placeholder = `{${index}}`
            index += 1
            return placeholder
          }).join('')

          report(path, raw)

          const item = textMap[raw]
          const i18nKey = String(item && item.id)
          path.replaceWith(
            t.CallExpression(
              t.Identifier(i18nMethodName),
              [
                t.stringLiteral(i18nKey),
                t.stringLiteral(raw),
                t.arrayExpression([...node.expressions]),
              ],
            ),
          )
        }
      },
    },
  }
}
