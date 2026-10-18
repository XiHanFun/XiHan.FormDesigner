/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 一种语言的表单文案：渲染器与设计器各一份，都是全量的；设计器的对照表与问题说明换成设计器读的函数，再与 designer-shell 同一语言的那份合成一个语言包。

import type { FormSchemaIssue, FormSchemaIssueCode, LinkageAction, PropertyGroup, ValidationKind } from '@xihan-form/core'
import type { XhConfig } from '@xihan-ui/web-components'
import type { FormDesignerTranslations } from '../designer-translations'
import type { FormRendererTranslations } from '../translations'
import { mergeXhConfig } from '@xihan-ui/web-components'

/** 内建种类的物料分类。 */
export type FormCategoryKey = 'input' | 'choice' | 'datetime' | 'advanced' | 'layout' | 'data' | 'static'

/** 内建种类：字段、容器与静态内容。 */
export type FormKindKey
  = | 'text'
    | 'textarea'
    | 'mention'
    | 'password'
    | 'number'
    | 'pin'
    | 'select'
    | 'combobox'
    | 'cascader'
    | 'tree-select'
    | 'radio-group'
    | 'checkbox-group'
    | 'toggle-group'
    | 'listbox'
    | 'tag-group'
    | 'transfer'
    | 'checkbox'
    | 'switch'
    | 'date'
    | 'date-range'
    | 'time'
    | 'time-range'
    | 'slider'
    | 'rating'
    | 'color'
    | 'tags'
    | 'file'
    | 'signature'
    | 'grid'
    | 'tabs'
    | 'card'
    | 'collapse'
    | 'fieldset'
    | 'table'
    | 'subform'
    | 'subtable'
    | 'divider'
    | 'paragraph'
    | 'heading'
    | 'alert'
    | 'image'
    | 'barcode'
    | 'qrcode'

/** 属性分组：三个属性组，加容器的区域属性与表单设置。 */
export type FormGroupKey = PropertyGroup | 'region' | 'settings'

/** 属性名的对照键：按属性名；某个种类要单独的说法时按「种类:分组.名」。 */
export type FormPropertyKey
  = | 'key'
    | 'label'
    | 'hint'
    | 'placeholder'
    | 'initialValue'
    | 'hidden'
    | 'disabled'
    | 'readOnly'
    | 'labelHidden'
    | 'size'
    | 'options'
    | 'optionSource'
    | 'optionDependencies'
    | 'multiple'
    | 'orientation'
    | 'inputType'
    | 'prefix'
    | 'level'
    | 'tone'
    | 'src'
    | 'alt'
    | 'width'
    | 'barcode:basic.value'
    | 'qrcode:basic.value'
    | 'showText'
    | 'barcode:basic.format'
    | 'qrcode:basic.format'
    | 'suffix'
    | 'minRows'
    | 'maxRows'
    | 'triggerPrefix'
    | 'mention:data.options'
    | 'mention:data.optionSource'
    | 'mention:data.optionDependencies'
    | 'step'
    | 'precision'
    | 'length'
    | 'mask'
    | 'withTime'
    | 'withSeconds'
    | 'min'
    | 'max'
    | 'range'
    | 'count'
    | 'allowHalf'
    | 'format'
    | 'swatches'
    | 'display'
    | 'accept'
    | 'maxFiles'
    | 'uploadTarget'
    | 'title'
    | 'legend'
    | 'content'
    | 'gap'
    | 'span'
    | 'offset'
    | 'expanded'
    | 'rows'
    | 'columns'
    | 'bordered'
    | 'row'
    | 'column'
    | 'rowSpan'
    | 'columnSpan'
    | 'initialRows'
    | 'movable'
    | 'labelPlacement'

/** 选项名的对照键：「属性名.取值」。 */
export type FormOptionKey
  = | 'size.sm'
    | 'size.md'
    | 'size.lg'
    | 'gap.xs'
    | 'gap.sm'
    | 'gap.md'
    | 'gap.lg'
    | 'gap.xl'
    | 'orientation.horizontal'
    | 'orientation.vertical'
    | 'labelPlacement.top'
    | 'labelPlacement.start'
    | 'inputType.text'
    | 'inputType.email'
    | 'inputType.tel'
    | 'inputType.url'
    | 'level.2'
    | 'level.3'
    | 'level.4'
    | 'level.5'
    | 'level.6'
    | 'tone.info'
    | 'tone.success'
    | 'tone.warning'
    | 'tone.danger'
    | 'tone.neutral'
    | 'display.picker'
    | 'display.swatches'
    | 'format.qr'
    | 'format.data-matrix'
    | 'format.pdf417'
    | 'format.aztec'

/** 问题说明读参数与内建名字的口子。 */
export interface FormIssueContext {
  /** 参数的文字形式，没有这个参数时为空串。 */
  readonly param: (key: string) => string
  /** 种类名，表里没有的原样返回。 */
  readonly kind: (kind: string) => string
  /** 校验规则种类名，表里没有的原样返回。 */
  readonly ruleKind: (kind: string) => string
  /** 联动动作名，表里没有的原样返回。 */
  readonly linkageAction: (action: string) => string
}

/** 一条模板结构问题的说明。 */
export type FormIssueText = (context: FormIssueContext) => string

/** 设计器一种语言的文案：对照表与问题说明按内建的键各写一条，少键、多键都是类型错误。 */
export interface FormDesignerLocale extends Omit<FormDesignerTranslations, 'nodeTag' | 'category' | 'kind' | 'group' | 'property' | 'option' | 'ruleKind' | 'linkageAction' | 'issue'> {
  readonly categories: Readonly<Record<FormCategoryKey, string>>
  readonly kinds: Readonly<Record<FormKindKey, string>>
  readonly groups: Readonly<Record<FormGroupKey, string>>
  readonly propertyLabels: Readonly<Record<FormPropertyKey, string>>
  readonly optionLabels: Readonly<Record<FormOptionKey, string>>
  readonly ruleKinds: Readonly<Record<ValidationKind, string>>
  readonly linkageActions: Readonly<Record<LinkageAction, string>>
  readonly issueTexts: Readonly<Record<FormSchemaIssueCode, FormIssueText>>
}

/** 表单一种语言的全部文案。 */
export interface FormLocale {
  readonly renderer: FormRendererTranslations
  readonly designer: FormDesignerLocale
}

function own<T>(table: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined
}

function lookup(table: Readonly<Record<string, string>>): (key: string) => string {
  return key => own(table, key) ?? key
}

/** 把对照表与问题说明换成设计器读的函数；表里没有的种类、属性、选项与问题码（如扩展登记的）原样显示。 */
export function formDesignerTranslations(locale: FormDesignerLocale): FormDesignerTranslations {
  const { categories, kinds, groups, propertyLabels, optionLabels, ruleKinds, linkageActions, issueTexts, ...strings } = locale
  const kind = lookup(kinds)
  const ruleKind = lookup(ruleKinds)
  const linkageAction = lookup(linkageActions)
  return {
    ...strings,
    nodeTag: (name: string, key: string | undefined) => (key === undefined ? kind(name) : `${kind(name)} · ${key}`),
    category: lookup(categories),
    kind,
    group: lookup(groups),
    property: (owner: string, scope: string, name: string) => own(propertyLabels, `${owner}:${scope}.${name}`) ?? own(propertyLabels, `${scope}.${name}`) ?? own(propertyLabels, name) ?? name,
    option: (name: string, value: string) => own(optionLabels, `${name}.${value}`) ?? value,
    ruleKind,
    linkageAction,
    issue: (found: FormSchemaIssue) => {
      const text = own<FormIssueText>(issueTexts, found.code)
      if (text === undefined)
        return found.code
      const param = (key: string): string => {
        const value = found.params?.[key]
        return value === undefined ? '' : String(value)
      }
      return text({ param, kind, ruleKind, linkageAction })
    },
  }
}

/** 把表单文案与 designer-shell 同一语言的那份合成一个语言包。 */
export function formLocale(shell: XhConfig, locale: FormLocale): XhConfig {
  return mergeXhConfig(shell, {
    translations: {
      'xh-form-renderer': locale.renderer,
      'xh-form-designer': formDesignerTranslations(locale.designer),
    },
  })
}
