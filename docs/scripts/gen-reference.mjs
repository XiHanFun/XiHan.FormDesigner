/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 从源码生成 reference/ 下的参考页：种类、属性与缺省值取自 @xihan-form/core 的内置种类，中文名与问题说明取自 formZhCN，
// 类型、元素的属性、方法与事件取自 form/packages 的 TypeScript 源码与注释。
// 带 --check 时只比对，与已提交的页面不一致就列出并以非零退出。

import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import * as core from '@xihan-form/core'
import { formZhCN } from '@xihan-form/runtime/locale'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import ts from 'typescript'

const docsDir = fileURLToPath(new URL('../', import.meta.url))
const repoDir = join(docsDir, '..')
const checkOnly = process.argv.includes('--check')

const GENERATED = '<!-- 本页由 docs/scripts/gen-reference.mjs 从源码生成，不要手改；源码变了之后在 docs/ 运行 pnpm gen。 -->'

const t = formZhCN.translations['xh-form-designer']
const rendererText = formZhCN.translations['xh-form-renderer']

function packageSource(...parts) {
  return join(repoDir, 'form', 'packages', ...parts)
}

// —— Markdown ——

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 行内代码；含 {{ 的写成 v-pre 的 <code>，免得被当成 Vue 插值。 */
function code(text, cell = false) {
  if (text.includes('{{'))
    return `<code v-pre>${escapeHtml(text).replace(/\|/g, '&#124;')}</code>`
  const body = cell ? text.replace(/\|/g, '\\|') : text
  return body.includes('`') ? `\`\` ${body} \`\`` : `\`${body}\``
}

/** 注释里的一段话：反引号里的按代码写，其余转义尖括号、花括号与表格里的竖线。 */
function prose(text, cell = false) {
  return text.split(/(`[^`]*`)/).map((part, index) => {
    if (index % 2 === 1)
      return code(part.slice(1, -1), cell)
    const escaped = escapeHtml(part).replace(/\{\{/g, '&#123;&#123;')
    return cell ? escaped.replace(/\|/g, '\\|') : escaped
  }).join('')
}

/** 注释里折行的两段接起来：两边都是 ASCII 字母数字时补一个空格。 */
function joinWrapped(left, right) {
  return /[\w)]$/.test(left) && /^[\w(`]/.test(right) ? `${left} ${right}` : `${left}${right}`
}

/** 注释按段落与列表项分块：普通行接到上一块，列表项另起一块。 */
function docBlocks(doc) {
  const blocks = []
  for (const line of doc.split('\n').map(item => item.trim()).filter(Boolean)) {
    if (line.startsWith('- ') || blocks.length === 0)
      blocks.push(line)
    else
      blocks[blocks.length - 1] = joinWrapped(blocks.at(-1), line)
  }
  return blocks
}

/** 注释写进表格单元格：并成一行，列表项另起一行。 */
function cellDoc(doc) {
  return docBlocks(doc).map(block => prose(block, true)).join('<br>')
}

/** 注释写成段落：列表项保留为 Markdown 列表。 */
function blockDoc(doc) {
  return docBlocks(doc).map((block, index) => {
    const text = prose(block)
    if (index === 0)
      return text
    return block.startsWith('- ') ? `\n${text}` : `\n\n${text}`
  }).join('')
}

function table(head, rows) {
  if (rows.length === 0)
    return ''
  return [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function page(title, intro, sections) {
  return `${[`# ${title}`, GENERATED, intro, ...sections].filter(Boolean).join('\n\n')}\n`
}

function anchorOf(name) {
  return name.toLowerCase()
}

// —— TypeScript 源码 ——

const sourceCache = new Map()

function sourceFile(file) {
  let source = sourceCache.get(file)
  if (source === undefined) {
    source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    sourceCache.set(file, source)
  }
  return source
}

function flat(node) {
  return node.getText().replace(/\s+/g, ' ').trim()
}

/** 节点的注释原文：按行去掉注释符号，文中的 @xihan-ui/... 之类不当作标签。 */
function jsdoc(node) {
  const doc = ts.getJSDocCommentsAndTags(node).filter(item => item.kind === ts.SyntaxKind.JSDoc).at(-1)
  if (doc === undefined)
    return ''
  return doc.getText()
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map(line => line.replace(/^\s*\* ?/, '').trimEnd())
    .join('\n')
    .trim()
}

function nameOf(node) {
  const name = node.name
  if (name === undefined)
    return ''
  return ts.isStringLiteral(name) || ts.isIdentifier(name) || ts.isPrivateIdentifier(name) ? name.text : name.getText()
}

function hasModifier(node, kind) {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some(modifier => modifier.kind === kind)
}

function isExported(statement) {
  return hasModifier(statement, ts.SyntaxKind.ExportKeyword)
}

function declarationsOf(source) {
  const found = new Map()
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations)
        found.set(declaration.name.getText(), { node: declaration, statement, exported: isExported(statement) })
      continue
    }
    const name = nameOf(statement)
    if (name !== '')
      found.set(name, { node: statement, statement, exported: isExported(statement) })
  }
  return found
}

function declaration(file, name) {
  const found = declarationsOf(sourceFile(file)).get(name)
  if (found === undefined)
    throw new Error(`[gen-reference] ${name} not found in ${file}`)
  return found
}

/** 参数列表：带缺省值的参数写成可选，不写缺省值。 */
function parameters(node) {
  return node.parameters.map((parameter) => {
    const optional = parameter.questionToken !== undefined || parameter.initializer !== undefined
    const rest = parameter.dotDotDotToken === undefined ? '' : '...'
    const type = parameter.type === undefined ? '' : `: ${flat(parameter.type)}`
    return `${rest}${parameter.name.getText()}${optional ? '?' : ''}${type}`
  }).join(', ')
}

function signature(name, node) {
  const typeParameters = node.typeParameters === undefined ? '' : `<${node.typeParameters.map(flat).join(', ')}>`
  const returns = node.type === undefined ? '' : `: ${flat(node.type)}`
  return `${name}${typeParameters}(${parameters(node)})${returns}`
}

/** 接口的成员：函数类型的属性当作方法。 */
function interfaceMembers(file, name) {
  const { node } = declaration(file, name)
  if (!ts.isInterfaceDeclaration(node))
    throw new Error(`[gen-reference] ${name} is not an interface`)
  return node.members.map((member) => {
    const memberName = nameOf(member)
    const doc = jsdoc(member)
    const optional = member.questionToken !== undefined
    const readonly = hasModifier(member, ts.SyntaxKind.ReadonlyKeyword)
    if (ts.isMethodSignature(member))
      return { kind: 'method', name: memberName, signature: signature(memberName, member), doc, optional }
    if (ts.isPropertySignature(member) && member.type !== undefined && ts.isFunctionTypeNode(member.type))
      return { kind: 'method', name: memberName, signature: signature(memberName, member.type), doc, optional }
    return { kind: 'property', name: memberName, type: member.type === undefined ? 'unknown' : flat(member.type), doc, optional, readonly }
  })
}

function heritageOf(node) {
  return (node.heritageClauses ?? []).flatMap(clause => clause.types.map(flat))
}

/** 元素类：注册的属性、声明的字段与存取器、公开方法。 */
function classMembers(file, className) {
  const { node } = declaration(file, className)
  const config = new Map()
  const properties = []
  const accessors = new Map()
  const methods = []
  for (const member of node.members) {
    const name = nameOf(member)
    const isStatic = hasModifier(member, ts.SyntaxKind.StaticKeyword)
    if (isStatic && ts.isPropertyDeclaration(member) && name === 'properties' && member.initializer !== undefined && ts.isObjectLiteralExpression(member.initializer)) {
      for (const property of member.initializer.properties) {
        const options = {}
        if (ts.isObjectLiteralExpression(property.initializer)) {
          for (const item of property.initializer.properties)
            options[nameOf(item)] = item.initializer.getText()
        }
        config.set(nameOf(property), options)
      }
      continue
    }
    if (isStatic || ts.isPrivateIdentifier(member.name ?? member) || hasModifier(member, ts.SyntaxKind.ProtectedKeyword) || hasModifier(member, ts.SyntaxKind.PrivateKeyword))
      continue
    if (ts.isPropertyDeclaration(member) && hasModifier(member, ts.SyntaxKind.DeclareKeyword)) {
      properties.push({ name, type: flat(member.type), doc: jsdoc(member) })
      continue
    }
    if (ts.isGetAccessorDeclaration(member)) {
      const entry = accessors.get(name) ?? { name }
      Object.assign(entry, { type: flat(member.type), doc: jsdoc(member) || entry.doc })
      accessors.set(name, entry)
      continue
    }
    if (ts.isSetAccessorDeclaration(member)) {
      const entry = accessors.get(name) ?? { name }
      Object.assign(entry, { writable: true, doc: entry.doc || jsdoc(member) })
      accessors.set(name, entry)
      continue
    }
    if (ts.isMethodDeclaration(member) && !hasModifier(member, ts.SyntaxKind.OverrideKeyword))
      methods.push({ name, signature: signature(name, member), doc: jsdoc(member) })
  }
  const attribute = (name) => {
    const options = config.get(name)
    if (options === undefined || options.attribute === 'false')
      return undefined
    if (options.attribute !== undefined)
      return options.attribute.replace(/^'|'$/g, '')
    return name.toLowerCase()
  }
  return {
    properties: properties.filter(property => config.has(property.name)).map(property => ({ ...property, attribute: attribute(property.name) })),
    accessors: [...accessors.values()],
    methods,
  }
}

/** 字符串字面量联合的取值。 */
function literalUnion(file, name) {
  const { node } = declaration(file, name)
  const type = node.type
  const members = ts.isUnionTypeNode(type) ? type.types : [type]
  return members.map((member) => {
    if (!ts.isLiteralTypeNode(member) || !ts.isStringLiteral(member.literal))
      throw new Error(`[gen-reference] ${name} is not a string literal union`)
    return member.literal.text
  })
}

function constantValue(file, name) {
  return flat(declaration(file, name).node.initializer)
}

function functionSignature(file, name) {
  const { node } = declaration(file, name)
  return { signature: signature(name, node), doc: jsdoc(node) }
}

// —— 渲染元素 API ——

function memberTable(members) {
  const properties = members.filter(member => member.kind === 'property')
  return table(['属性', '类型', '说明'], properties.map(member => [
    code(member.optional ? `${member.name}?` : member.name, true),
    code(member.type, true),
    cellDoc(member.doc),
  ]))
}

function methodTable(methods) {
  return table(['方法', '说明'], methods.map(method => [code(method.signature, true), cellDoc(method.doc)]))
}

function interfaceSection(file, name, level = '###', intro = '') {
  const { node } = declaration(file, name)
  const members = interfaceMembers(file, name)
  const heritage = heritageOf(node)
  const methods = members.filter(member => member.kind === 'method')
  return [
    `${level} ${name} {#${anchorOf(name)}}`,
    blockDoc(jsdoc(node)),
    intro,
    heritage.length > 0 ? `继承 ${heritage.map(item => code(item)).join('、')}。` : '',
    memberTable(members),
    methodTable(methods),
  ].filter(Boolean).join('\n\n')
}

function eventTable(file, name) {
  return table(['事件', 'detail', '说明'], interfaceMembers(file, name).map((member) => {
    const detail = /^CustomEvent<(.*)>$/.exec(member.type)?.[1] ?? member.type
    return [code(member.name, true), code(detail, true), cellDoc(member.doc)]
  }))
}

function elementSections(file, className, eventMap) {
  const { properties, accessors, methods } = classMembers(file, className)
  return [
    '### 属性',
    table(['属性', 'attribute', '类型', '说明'], properties.map(property => [
      code(property.name, true),
      property.attribute === undefined ? '—' : code(property.attribute, true),
      code(property.type, true),
      cellDoc(property.doc),
    ])),
    accessors.length > 0 ? '### 存取器' : '',
    table(['属性', '读写', '类型', '说明'], accessors.map(accessor => [
      code(accessor.name, true),
      accessor.writable ? '可读写' : '只读',
      code(accessor.type, true),
      cellDoc(accessor.doc ?? ''),
    ])),
    '### 方法',
    methodTable(methods),
    '### 事件',
    '事件都是冒泡的 `CustomEvent`。',
    eventTable(file, eventMap),
  ].filter(Boolean).join('\n\n')
}

/** 函数签名写成 TypeScript 代码块。 */
function fence(text) {
  return `\`\`\`ts\ndeclare function ${text}\n\`\`\``
}

function functionSection(file, name) {
  const { signature: text, doc } = functionSignature(file, name)
  return [`### ${name}() {#${anchorOf(name)}}`, fence(text), blockDoc(doc)].filter(Boolean).join('\n\n')
}

// —— 全部导出 ——

function resolveModule(fromFile, specifier) {
  const base = join(dirname(fromFile), specifier)
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate))
      return candidate
  }
  throw new Error(`[gen-reference] cannot resolve ${specifier} from ${fromFile}`)
}

const KIND_NAMES = {
  [ts.SyntaxKind.FunctionDeclaration]: '函数',
  [ts.SyntaxKind.ClassDeclaration]: '类',
  [ts.SyntaxKind.InterfaceDeclaration]: '接口',
  [ts.SyntaxKind.TypeAliasDeclaration]: '类型',
  [ts.SyntaxKind.VariableDeclaration]: '常量',
}

/** 注释的第一句。 */
function summary(doc) {
  const first = docBlocks(doc)[0] ?? ''
  const stop = first.indexOf('。')
  return stop >= 0 ? first.slice(0, stop + 1) : first
}

/** 入口文件导出的全部名字，按来源模块分组；转导出的外部包标注来源。 */
function exportIndex(entry) {
  const groups = new Map()
  const add = (module, name, info) => {
    const list = groups.get(module) ?? []
    if (!list.some(item => item.name === name))
      list.push({ name, ...info })
    groups.set(module, list)
  }
  const describe = (file, name) => {
    const found = declarationsOf(sourceFile(file)).get(name)
    if (found !== undefined)
      return { kind: KIND_NAMES[found.node.kind] ?? '—', doc: summary(jsdoc(found.node.kind === ts.SyntaxKind.VariableDeclaration ? found.statement : found.node)) }
    // 本模块没有声明，顺着 `export { … } from './…'` 到声明它的模块去找
    for (const statement of sourceFile(file).statements) {
      const specifier = ts.isExportDeclaration(statement) ? statement.moduleSpecifier?.text : undefined
      if (specifier === undefined || !specifier.startsWith('.'))
        continue
      const element = statement.exportClause?.elements?.find(item => item.name.text === name)
      if (element !== undefined)
        return describe(resolveModule(file, specifier), (element.propertyName ?? element.name).text)
    }
    return { kind: '—', doc: '' }
  }
  const collect = (file, module) => {
    const source = sourceFile(file)
    for (const statement of source.statements) {
      if (ts.isExportDeclaration(statement)) {
        const specifier = statement.moduleSpecifier?.text
        if (specifier === undefined)
          continue
        if (!specifier.startsWith('.')) {
          for (const element of statement.exportClause?.elements ?? [])
            add(module, element.name.text, { kind: '类型', doc: `转导出自 ${specifier}` })
          continue
        }
        const target = resolveModule(file, specifier)
        const targetModule = target.slice(entry.root.length + 1).replace(/\\/g, '/').replace(/\.ts$/, '')
        if (statement.exportClause === undefined) {
          collect(target, targetModule)
          continue
        }
        for (const element of statement.exportClause.elements)
          add(targetModule, element.name.text, describe(target, (element.propertyName ?? element.name).text))
        continue
      }
      if (!isExported(statement))
        continue
      if (ts.isVariableStatement(statement)) {
        for (const item of statement.declarationList.declarations)
          add(module, item.name.getText(), { kind: '常量', doc: summary(jsdoc(statement)) })
        continue
      }
      const name = nameOf(statement)
      if (name !== '')
        add(module, name, { kind: KIND_NAMES[statement.kind] ?? '—', doc: summary(jsdoc(statement)) })
    }
  }
  collect(entry.file, entry.file.slice(entry.root.length + 1).replace(/\\/g, '/').replace(/\.ts$/, ''))
  return groups
}

function exportIndexSection(title, entry) {
  const groups = exportIndex(entry)
  const parts = [`## ${title}`]
  for (const [module, items] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    parts.push(`### ${module}`)
    parts.push(table(['名称', '种类', '说明'], items.sort((a, b) => a.name.localeCompare(b.name)).map(item => [code(item.name, true), item.kind, prose(item.doc, true)])))
  }
  return parts.join('\n\n')
}

// —— 种类与属性 ——

const VALUE_KINDS = {
  'string': '字符串',
  'number': '数值',
  'boolean': '布尔',
  'string-list': '字符串数组',
  'number-list': '数值数组',
  'list': '数组',
  'object': '对象',
}

const TYPE_NAMES = { field: '字段', container: '容器', static: '静态元素' }

function describeControl(control, name) {
  switch (control.kind) {
    case 'text':
      return control.multiline ? '多行文本' : '文本'
    case 'boolean':
      return '布尔'
    case 'json':
      return '任意 JSON 值，形状随字段的值'
    case 'tags':
      return '字符串数组'
    case 'color':
      return '颜色'
    case 'number': {
      const range = [
        control.min === undefined ? undefined : `≥ ${control.min}`,
        control.max === undefined ? undefined : `≤ ${control.max}`,
      ].filter(Boolean)
      return `${control.integer ? '整数' : '数值'}${range.length > 0 ? `，${range.join('，')}` : ''}`
    }
    case 'select':
      return control.options.map((option) => {
        const value = String(option.value)
        const label = t.option(name, value)
        return label === value ? code(value, true) : `${code(value, true)} ${label}`
      }).join('、')
    case 'options':
      return `[选项](./schema#options)数组`
    case 'tree-options':
      return `[选项](./schema#options)树，每项可带 ${code('children')} 与 ${code('hasChildren')}`
    default:
      throw new Error(`[gen-reference] unknown property control kind: ${control.kind}`)
  }
}

function describeCondition(condition, label) {
  if (condition === undefined)
    return ''
  if (condition.all !== undefined)
    return condition.all.map(item => describeCondition(item, label)).join('且')
  if (condition.any !== undefined)
    return condition.any.map(item => describeCondition(item, label)).join('或')
  if (condition.not !== undefined)
    return `不满足「${describeCondition(condition.not, label)}」`
  const name = `「${label(String(condition.path.at(-1)))}」`
  if ('equals' in condition) {
    const value = condition.equals
    if (typeof value === 'boolean')
      return value ? `${name}打开` : `${name}关闭`
    return `${name}为 ${code(JSON.stringify(value), true)} `
  }
  if ('oneOf' in condition)
    return `${name}是 ${condition.oneOf.map(value => code(JSON.stringify(value), true)).join('、')} 之一`
  throw new Error(`[gen-reference] unknown property condition: ${JSON.stringify(condition)}`)
}

function defaultText(value) {
  if (value === undefined)
    return '—'
  const json = JSON.stringify(value)
  return json.length > 48 ? '…' : code(json, true)
}

/** 一组属性描述写成表格：属性写成所在属性包里的路径，名称是属性面板里的中文名。 */
function propertyTable(rows) {
  return table(['属性', '名称', '取值', '新建时'], rows.map(({ key, label, descriptor, value, nameOf }) => {
    const condition = describeCondition(descriptor.visibleWhen, nameOf)
    return [
      code(key, true),
      label,
      `${describeControl(descriptor.control, String(descriptor.path.at(-1)))}${condition === '' ? '' : `；${condition}时显示`}`,
      defaultText(value),
    ]
  }))
}

function nodePropertyTable(definition, node) {
  const rows = []
  for (const group of core.PROPERTY_GROUPS) {
    for (const descriptor of definition.properties[group]) {
      const name = core.propertyName(descriptor)
      rows.push({
        key: `${group}.${name}`,
        label: t.property(definition.kind, group, name),
        descriptor,
        value: node[group][name],
        nameOf: item => t.property(definition.kind, group, item),
      })
    }
  }
  return propertyTable(rows)
}

function regionPropertyTable(definition) {
  const initial = definition.regions.initial[0] ?? {}
  return propertyTable(definition.regionProperties.map((descriptor) => {
    const name = core.propertyName(descriptor)
    return {
      key: `props.${name}`,
      label: t.property(definition.kind, 'region', name),
      descriptor,
      value: initial[name],
      nameOf: item => t.property(definition.kind, 'region', item),
    }
  }))
}

/** 字段的值形状；打开某个布尔数据属性会改变形状时一并写出。 */
function valueFacts(definition, data) {
  const base = definition.valueKind(data)
  const variants = definition.properties.data
    .filter(descriptor => descriptor.control.kind === 'boolean')
    .map((descriptor) => {
      const name = core.propertyName(descriptor)
      const kind = definition.valueKind({ ...data, [name]: true })
      return kind === base ? undefined : `打开「${t.property(definition.kind, 'data', name)}」时为${VALUE_KINDS[kind]}`
    })
    .filter(Boolean)
  const empty = JSON.stringify(definition.emptyValue(data))
  return `值：${VALUE_KINDS[base]}${variants.length > 0 ? `（${variants.join('，')}）` : ''}，空值 ${code(empty)}`
}

function kindFacts(definition, node) {
  const facts = [`${TYPE_NAMES[definition.type]}`, `渲染为 ${code(`<${definition.element}>`)}`]
  if (definition.type === 'field') {
    facts.push(valueFacts(definition, node.data))
    facts.push(`适用的校验：${definition.validations.map(kind => t.ruleKind(kind)).join('、')}`)
  }
  if (definition.type === 'container') {
    facts.push(definition.scope === 'list' ? '带数据键，值是行对象的数组' : '只管排版，对数据透明')
    const { min, max } = definition.regions
    facts.push(max === min ? `区域固定 ${min} 个` : `区域 ${min} 个起${max === null ? '、不限上限' : `、最多 ${max} 个`}`)
    facts.push(definition.accepts === 'fields' ? '区域里只能放字段' : '区域里能放任意节点')
    if (definition.validations.length > 0)
      facts.push(`适用的校验：${definition.validations.map(kind => t.ruleKind(kind)).join('、')}`)
  }
  facts.push(`联动动作：${core.LINKAGE_ACTIONS[definition.type].map(action => t.linkageAction(action)).join('、')}`)
  return `${facts.join(' · ')}。`
}

function kindsPage() {
  const registry = core.createFormModel().registry
  const ids = createIdAllocator('n')
  const settings = core.createDocument().settings
  const sections = [
    '## 表单设置 {#settings}',
    `没有选中节点时，属性面板编辑表单设置，存放在文档的 ${code('settings')} 里。`,
    propertyTable(core.FORM_SETTING_PROPERTIES.map((descriptor) => {
      const name = core.propertyName(descriptor)
      return { key: `settings.${name}`, label: t.property('', 'settings', name), descriptor, value: settings[name], nameOf: item => t.property('', 'settings', item) }
    })),
  ]
  const categories = [...new Set(registry.list().map(definition => definition.category))]
  for (const category of categories) {
    sections.push(`## ${t.category(category)} {#category-${category}}`)
    for (const definition of registry.list().filter(item => item.category === category)) {
      const node = core.createNode(registry, definition.kind, ids, definition.type === 'field' || definition.scope === 'list' ? { key: 'key' } : {})
      sections.push(`### ${t.kind(definition.kind)} ${code(definition.kind)} {#${definition.kind}}`)
      sections.push(kindFacts(definition, node))
      sections.push(nodePropertyTable(definition, node))
      if (definition.type === 'container' && definition.regionProperties.length > 0) {
        sections.push(`区域属性，存放在各区域的 ${code('props')} 里：`)
        sections.push(regionPropertyTable(definition))
      }
    }
  }
  return page('种类与属性', [
    '内置种类按物料面板的分类列出。属性写成所在属性包里的路径（如 `basic.label` 即节点的 `basic` 里的 `label`）；「名称」是属性面板里的中文名；「新建时」是在设计器里新建节点时写入的值，过长的值以 … 代替。',
    '每个节点还有共有字段 `type`、`id`、`kind`、`validation`（静态元素没有）、`linkage` 与 `extensions`；字段与列表容器另有数据键 `key`，容器另有区域 `regions`。见[模板类型](./schema)。',
  ].join('\n\n'), sections)
}

// —— 模板类型 ——

function schemaNames(file) {
  const names = new Set()
  for (const [name, found] of declarationsOf(sourceFile(file))) {
    if (found.exported && (ts.isInterfaceDeclaration(found.node) || ts.isTypeAliasDeclaration(found.node)))
      names.add(name)
  }
  return names
}

/** 类型文字里出现的本页类型名换成页内链接。 */
function linkedType(text, names) {
  const html = escapeHtml(text).replace(/\|/g, '&#124;').replace(/\b[A-Z]\w*\b/g, word => (names.has(word) ? `<a href="#${anchorOf(word)}">${word}</a>` : word))
  return `<code>${html}</code>`
}

function schemaPage() {
  const path = packageSource('core', 'src', 'schema.ts')
  const names = schemaNames(path)
  const sections = []
  for (const statement of sourceFile(path).statements) {
    if (!isExported(statement))
      continue
    if (ts.isInterfaceDeclaration(statement)) {
      const name = nameOf(statement)
      const members = interfaceMembers(path, name)
      sections.push([
        `### ${name} {#${anchorOf(name)}}`,
        blockDoc(jsdoc(statement)),
        table(['字段', '类型', '必填', '说明'], members.map(member => [
          code(member.name, true),
          member.kind === 'method' ? code(member.signature, true) : linkedType(member.type, names),
          member.optional ? '可省' : '是',
          cellDoc(member.doc),
        ])),
      ].filter(Boolean).join('\n\n'))
      continue
    }
    if (ts.isTypeAliasDeclaration(statement)) {
      const name = nameOf(statement)
      const type = statement.type
      const parts = [`### ${name} {#${anchorOf(name)}}`, blockDoc(jsdoc(statement))]
      if (ts.isUnionTypeNode(type) && type.types.every(item => ts.isTypeReferenceNode(item)))
        parts.push(`取其一：${type.types.map(item => linkedType(flat(item), names)).join('、')}。`)
      else
        parts.push(`类型：${linkedType(flat(type), names)}`)
      sections.push(parts.filter(Boolean).join('\n\n'))
    }
  }
  const optionControls = packageSource('core', 'src', 'registry', 'properties.ts')
  return page('模板类型', [
    `表单文档 ${code('FormDocument')} 的全部类型，按 ${code('@xihan-form/core')} 的源码列出。当前结构版本 ${code('FORM_SCHEMA_VERSION')} 为 ${code(constantValue(path, 'FORM_SCHEMA_VERSION'))}。`,
    '各种类的属性包里有哪些属性见[种类与属性](./kinds)。',
  ].join('\n\n'), [
    '## 文档、节点与规则',
    ...sections,
    '## 选项 {#options}',
    blockDoc(jsdoc(declaration(optionControls, 'FORM_CONTROLS').statement)),
  ])
}

// —— 问题码 ——

/** 按问题码生成中文说明：参数写成 {名}，返回说明与用到的参数名。 */
function sampleIssue(issueCode) {
  const keys = []
  const params = new Proxy({}, {
    get(_, key) {
      if (typeof key !== 'string')
        return undefined
      if (!keys.includes(key))
        keys.push(key)
      return `{${key}}`
    },
    has: () => true,
  })
  return { text: t.issue({ code: issueCode, path: [], params }).replace(/NaN/g, '…'), keys }
}

/** 中文语言包里 issue 文案按问题码分支的全部问题码。 */
function translatedIssueCodes() {
  const file = packageSource('runtime', 'src', 'designer-zh-cn.ts')
  const { node } = declaration(file, 'issue')
  const codes = []
  const visit = (child) => {
    if (ts.isCaseClause(child) && ts.isStringLiteral(child.expression))
      codes.push(child.expression.text)
    ts.forEachChild(child, visit)
  }
  visit(node)
  return codes
}

function schemaIssueTable(codes) {
  return table(['问题码', '设计器里的说明', '参数'], codes.map((issueCode) => {
    const { text, keys } = sampleIssue(issueCode)
    return [code(issueCode, true), prose(text, true), keys.map(key => code(key, true)).join('、') || '—']
  }))
}

/** 值问题的文案：从渲染器的 issueMessage 读出每个问题码取哪条文案、带哪个参数。 */
function valueIssueTable() {
  const file = packageSource('runtime', 'src', 'renderer', 'messages.ts')
  const { node } = declaration(file, 'issueMessage')
  const rows = []
  const visit = (child) => {
    if (ts.isCaseClause(child) && ts.isStringLiteral(child.expression)) {
      const returned = child.statements.find(statement => ts.isReturnStatement(statement))?.expression
      if (returned === undefined)
        throw new Error(`[gen-reference] ${child.expression.text} 没有返回文案`)
      let text
      let keys = []
      if (ts.isPropertyAccessExpression(returned)) {
        text = rendererText[returned.name.text]
      }
      else if (ts.isCallExpression(returned) && ts.isPropertyAccessExpression(returned.expression)) {
        keys = returned.arguments.map(argument => argument.arguments?.[1]?.text).filter(Boolean)
        text = rendererText[returned.expression.name.text](...keys.map(key => `{${key}}`))
      }
      if (typeof text !== 'string')
        throw new Error(`[gen-reference] ${child.expression.text} 的文案读不出来`)
      rows.push([code(child.expression.text, true), prose(text, true), keys.map(key => code(key, true)).join('、') || '—'])
    }
    ts.forEachChild(child, visit)
  }
  visit(node)
  return table(['问题码', '渲染器里的缺省文案', '参数'], rows)
}

function issuesPage() {
  const issues = packageSource('core', 'src', 'issues.ts')
  const errors = packageSource('runtime', 'src', 'state', 'errors.ts')
  const product = new Set(literalUnion(issues, 'FormSchemaProductCode'))
  const translated = translatedIssueCodes()
  const missing = [...product].filter(item => !translated.includes(item))
  if (missing.length > 0)
    throw new Error(`[gen-reference] 中文语言包缺少问题码的说明：${missing.join('、')}`)
  return page('问题码', '问题都不带文案，只有问题码、定位与参数；下表的说明来自中文语言包 `formZhCN`，其中的 {名} 是参数。', [
    '## 模板问题 {#schema}',
    `模板问题由 ${code('validateDocument')} 与设计器的问题列表给出，缺省都是错误级，${code('severity')} 选项可以按问题码改为警告或去掉；有错误级问题的模板，渲染器不渲染、派发 ${code('schema-error')}。`,
    blockDoc(jsdoc(declaration(issues, 'FormSchemaIssue').node)),
    '### 通用问题码',
    '属性值与结构的通用检查，各款设计器共用。',
    schemaIssueTable(translated.filter(item => !product.has(item))),
    '### 表单问题码',
    blockDoc(jsdoc(declaration(issues, 'FormSchemaProductCode').node)),
    schemaIssueTable(translated.filter(item => product.has(item))),
    '## 值问题 {#value}',
    `值问题由 ${code('validateValues')}、控制器与渲染器的校验给出，落在字段上，渲染器把文案写在字段下方并汇总到错误摘要。规则写了 ${code('message')} 时显示它，否则用下表的缺省文案。`,
    blockDoc(jsdoc(declaration(issues, 'FormIssueCode').node)),
    valueIssueTable(),
    '## 运行时错误 {#runtime}',
    blockDoc(jsdoc(declaration(errors, 'FormRuntimeErrorCode').node)),
    `${code('FormRuntimeError')} 的 ${code('code')} 是上面的错误码之一，${code('data')} 带定位数据，模板无效时 ${code('issues')} 是全部模板问题。`,
  ])
}

// —— 渲染器 ——

function typeSection(file, name) {
  const { node } = declaration(file, name)
  return [`### ${name} {#${anchorOf(name)}}`, blockDoc(jsdoc(node)), fenceType(flat(node))].filter(Boolean).join('\n\n')
}

/** 类型别名原样写成 TypeScript 代码块，去掉 export。 */
function fenceType(text) {
  return `\`\`\`ts\n${text.replace(/^export /, '')}\n\`\`\``
}

function rendererPage() {
  const element = packageSource('runtime', 'src', 'renderer', 'element.ts')
  const controller = packageSource('runtime', 'src', 'state', 'controller.ts')
  const options = packageSource('runtime', 'src', 'state', 'options.ts')
  const types = packageSource('runtime', 'src', 'renderer', 'types.ts')
  const extensions = packageSource('runtime', 'src', 'extensions.ts')
  const translations = packageSource('runtime', 'src', 'translations.ts')
  const root = packageSource('runtime', 'src')
  return page('渲染器', `${code('@xihan-form/runtime')} 的公开接口：渲染器元素、表单控制器与相关类型。样式在 ${code('@xihan-form/runtime/style.css')}，中文语言包在 ${code('@xihan-form/runtime/locale')}。`, [
    `## ${code('<xh-form-renderer>')}`,
    blockDoc(functionSignature(element, 'defineFormRenderer').doc),
    elementSections(element, 'XhFormRenderer', 'FormRendererEventMap'),
    typeSection(element, 'FormValidateOn'),
    typeSection(element, 'FormSubmitAction'),
    '## 表单控制器',
    functionSection(controller, 'createFormController'),
    interfaceSection(controller, 'FormControllerOptions'),
    interfaceSection(controller, 'FormController'),
    interfaceSection(controller, 'ValidationOutcome'),
    interfaceSection(controller, 'GetFormDataOptions'),
    interfaceSection(controller, 'SetFormDataOptions'),
    interfaceSection(controller, 'AddRowOptions'),
    '## 选项与上传',
    typeSection(options, 'OptionLoader'),
    interfaceSection(options, 'OptionRequest'),
    interfaceSection(options, 'OptionItem'),
    interfaceSection(options, 'OptionsState'),
    typeSection(types, 'FileUploader'),
    interfaceSection(types, 'UploadRequest'),
    '## 扩展',
    interfaceSection(extensions, 'FormRuntimeExtension'),
    typeSection(types, 'FieldRenderer'),
    interfaceSection(types, 'FieldRendererContext'),
    interfaceSection(types, 'FieldRendererInstance'),
    '## 文案',
    interfaceSection(translations, 'FormRendererTranslations', '###', `文案键是 ${code('xh-form-renderer')}，中文在 ${code('@xihan-form/runtime/locale')} 的 ${code('formZhCN')} 里。`),
    exportIndexSection('全部导出', { root, file: join(root, 'index.ts') }),
    exportIndexSection(`${code('@xihan-form/runtime/locale')} 的导出`, { root, file: join(root, 'locale.ts') }),
  ])
}

// —— 设计器 ——

function unionSection(file, name) {
  return `### ${name} {#${anchorOf(name)}}\n\n${blockDoc(jsdoc(declaration(file, name).node))}取值：${literalUnion(file, name).map(item => code(item)).join('、')}。`
}

function designerPage() {
  const designer = packageSource('designer', 'src', 'form-designer.ts')
  const internals = packageSource('designer', 'src', 'internals.ts')
  const editor = packageSource('designer', 'src', 'editor.ts')
  const commands = packageSource('designer', 'src', 'commands.ts')
  const extensions = packageSource('designer', 'src', 'extensions.ts')
  const translations = packageSource('runtime', 'src', 'designer-translations.ts')
  const root = packageSource('designer', 'src')
  return page('设计器', `${code('@xihan-form/designer')} 的公开接口。样式在 ${code('@xihan-form/designer/style.css')}，还要同时引入 ${code('@xihan-ui/designer-shell/style.css')} 与 ${code('@xihan-form/runtime/style.css')}。`, [
    `## ${code('<xh-form-designer>')}`,
    blockDoc(functionSignature(designer, 'defineFormDesigner').doc),
    elementSections(designer, 'XhFormDesigner', 'FormDesignerEventMap'),
    '## 类型',
    unionSection(internals, 'FormDesignerMode'),
    unionSection(designer, 'FormPreviewWidth'),
    unionSection(designer, 'FormDesignerPanel'),
    unionSection(designer, 'FormSchemaChangeKind'),
    interfaceSection(editor, 'FormSelection'),
    interfaceSection(editor, 'FormDropTarget'),
    interfaceSection(editor, 'FormClipboard'),
    '## 扩展与命令',
    interfaceSection(extensions, 'FormDesignerExtension', '###', `其余成员见视图组件文档的 [designer-shell](https://ui.docs.xihanfun.com/runtime/designer-shell)。`),
    interfaceSection(commands, 'FormDesignerContext'),
    typeSection(commands, 'FormDesignerCommand'),
    unionSection(commands, 'FormMenuSubject'),
    '## 文案',
    interfaceSection(translations, 'FormDesignerTranslations', '###', `文案键是 ${code('xh-form-designer')}，中文在 ${code('@xihan-form/runtime/locale')} 的 ${code('formZhCN')} 里。`),
    '## 编辑模型',
    `设计器内部的编辑模型也一并导出，不显示界面、只想按操作改模板时可以直接用。${blockDoc(functionSignature(editor, 'createFormEditor').doc)}`,
    fence(functionSignature(editor, 'createFormEditor').signature),
    interfaceSection(editor, 'FormEditorOptions'),
    interfaceSection(editor, 'FormEditor'),
    exportIndexSection('全部导出', { root, file: join(root, 'index.ts') }),
  ])
}

// —— 模型层 ——

function corePage() {
  const root = packageSource('core', 'src')
  const validateDocument = join(root, 'validate-document.ts')
  const validateValues = join(root, 'validate-values.ts')
  const linkage = join(root, 'linkage.ts')
  const create = join(root, 'create.ts')
  const extensions = join(root, 'extensions.ts')
  return page('模型层 core', `${code('@xihan-form/core')} 是纯 TypeScript 的模型层：模板类型、模板自检、取值校验、联动求值与编辑操作，不依赖 DOM，浏览器、Node.js 与其它 JavaScript 运行环境里都能用。模板类型的字段见[模板类型](./schema)，种类的属性见[种类与属性](./kinds)。`, [
    '## 检查与校验',
    functionSection(validateDocument, 'validateDocument'),
    interfaceSection(validateDocument, 'ValidateDocumentOptions'),
    functionSection(validateValues, 'validateValues'),
    interfaceSection(validateValues, 'ValidateValuesOptions'),
    interfaceSection(validateValues, 'ValueIssue'),
    '## 联动',
    functionSection(linkage, 'resolveLinkage'),
    interfaceSection(linkage, 'ResolveLinkageOptions'),
    interfaceSection(linkage, 'LinkageResult'),
    interfaceSection(linkage, 'NodeState'),
    '## 新建',
    functionSection(create, 'createDocument'),
    functionSection(create, 'createNode'),
    interfaceSection(create, 'CreateNodeOptions'),
    '## 扩展',
    interfaceSection(extensions, 'FormCoreExtension'),
    functionSection(extensions, 'createFormModel'),
    exportIndexSection('全部导出', { root, file: join(root, 'index.ts') }),
  ])
}

// —— 输出 ——

const pages = {
  'reference/kinds.md': kindsPage(),
  'reference/schema.md': schemaPage(),
  'reference/issues.md': issuesPage(),
  'reference/renderer.md': rendererPage(),
  'reference/designer.md': designerPage(),
  'reference/core.md': corePage(),
}

const stale = []
for (const [relative, content] of Object.entries(pages)) {
  const target = join(docsDir, relative)
  const current = existsSync(target) ? await readFile(target, 'utf8') : undefined
  if (current === content)
    continue
  stale.push(relative)
  if (!checkOnly) {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content)
  }
}

if (checkOnly && stale.length > 0) {
  console.error(`参考页与源码不一致，在 docs/ 运行 pnpm gen 重新生成：\n${stale.map(item => `  ${item}`).join('\n')}`)
  process.exit(1)
}
console.log(stale.length === 0 ? '参考页已是最新' : `已生成：${stale.join('、')}`)
