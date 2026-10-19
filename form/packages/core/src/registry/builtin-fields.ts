/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 内置字段种类：每种对应一个 XiHan.UI 字段元素。

import type { JsonValue } from '@xihan-ui/core/json'
import type { PropertyBag, ValidationKind } from '../schema'
import type { FieldKindDefinition, ValueKind } from './kinds'
import type { FormPropertyDescriptor } from './properties'

const LABEL: FormPropertyDescriptor = { path: ['label'], control: { kind: 'text' }, default: '' }
const HINT: FormPropertyDescriptor = { path: ['hint'], control: { kind: 'text', multiline: true } }
const PLACEHOLDER: FormPropertyDescriptor = { path: ['placeholder'], control: { kind: 'text' } }
const INITIAL_VALUE: FormPropertyDescriptor = { path: ['initialValue'], control: { kind: 'json' } }
const HIDDEN: FormPropertyDescriptor = { path: ['hidden'], control: { kind: 'boolean' }, default: false }
const DISABLED: FormPropertyDescriptor = { path: ['disabled'], control: { kind: 'boolean' }, default: false }
const READ_ONLY: FormPropertyDescriptor = { path: ['readOnly'], control: { kind: 'boolean' }, default: false }
const LABEL_HIDDEN: FormPropertyDescriptor = { path: ['labelHidden'], control: { kind: 'boolean' }, default: false }
const SIZE: FormPropertyDescriptor = { path: ['size'], control: { kind: 'select', options: [{ value: 'sm' }, { value: 'md' }, { value: 'lg' }] }, default: 'md' }
/** 放在子表里作一列时这一列的最小宽度（px）：各列下限加起来超过子表宽时，子表的表格区横向滚动。 */
const COLUMN_MIN_WIDTH: FormPropertyDescriptor = { path: ['columnMinWidth'], control: { kind: 'number', integer: true, min: 48, max: 1024, unit: 'px' } }
/**
 * 选项：选项列表用 designer-kit 的内建编辑方式 `options`，选项树用 `treeOptions`，都要求 label。
 * 每项是 `{ value: string, label: string, disabled?: boolean, tone?: Tone, description?: string }`，
 * 选项树的项另可带 `children`（下一层的选项）与 `hasChildren`（有子项但还没给出，首次展开时向宿主要）。
 * 按 `@xihan-ui/core/options` 的 `findOptionViolation` 严格检查：不许多余的键，`value` 不为空、同一层里不重复，选项树最多 32 层；
 * 问题落在那一项的那个键上，如 `[2, "value"]`、`[0, "children", 1, "label"]`。
 */
const OPTIONS: FormPropertyDescriptor = { path: ['options'], control: { kind: 'options', requireLabel: true }, default: [] }
const TREE_OPTIONS: FormPropertyDescriptor = { path: ['options'], control: { kind: 'treeOptions', requireLabel: true }, default: [] }
const OPTION_SOURCE: FormPropertyDescriptor = { path: ['optionSource'], control: { kind: 'text' } }
const OPTION_DEPENDENCIES: FormPropertyDescriptor = { path: ['optionDependencies'], control: { kind: 'tags' } }
const MULTIPLE: FormPropertyDescriptor = { path: ['multiple'], control: { kind: 'boolean' }, default: false }
const ORIENTATION: FormPropertyDescriptor = { path: ['orientation'], control: { kind: 'select', options: [{ value: 'horizontal' }, { value: 'vertical' }] }, default: 'horizontal' }
const WITH_TIME: FormPropertyDescriptor = { path: ['withTime'], control: { kind: 'boolean' }, default: false }
const WITH_SECONDS: FormPropertyDescriptor = { path: ['withSeconds'], control: { kind: 'boolean' }, default: false }
const AFFIXES: readonly FormPropertyDescriptor[] = [
  { path: ['prefix'], control: { kind: 'text' } },
  { path: ['suffix'], control: { kind: 'text' } },
]

const TEXT_RULES: readonly ValidationKind[] = ['required', 'length', 'pattern', 'expression']
const NUMBER_RULES: readonly ValidationKind[] = ['required', 'range', 'expression']
const CHOICE_RULES: readonly ValidationKind[] = ['required', 'length', 'expression']
const PLAIN_RULES: readonly ValidationKind[] = ['required', 'expression']
const BOOLEAN_RULES: readonly ValidationKind[] = ['required', 'accepted', 'expression']

interface FieldSpec {
  readonly kind: string
  readonly category: string
  readonly element: string
  readonly placeholder?: boolean
  readonly readOnly?: boolean
  readonly data?: readonly FormPropertyDescriptor[]
  readonly appearance?: readonly FormPropertyDescriptor[]
  readonly validations: readonly ValidationKind[]
  readonly valueKind: ValueKind | ((data: PropertyBag) => ValueKind)
  readonly emptyValue: JsonValue | ((data: PropertyBag) => JsonValue)
}

function field(spec: FieldSpec): FieldKindDefinition {
  const basic = [LABEL, HINT]
  if (spec.placeholder === true)
    basic.push(PLACEHOLDER)
  basic.push(INITIAL_VALUE, HIDDEN, DISABLED)
  if (spec.readOnly !== false)
    basic.push(READ_ONLY)
  const { valueKind, emptyValue } = spec
  return {
    type: 'field',
    kind: spec.kind,
    category: spec.category,
    element: spec.element,
    properties: {
      basic,
      data: spec.data ?? [],
      appearance: [LABEL_HIDDEN, SIZE, COLUMN_MIN_WIDTH, ...(spec.appearance ?? [])],
    },
    validations: spec.validations,
    valueKind: typeof valueKind === 'function' ? valueKind : () => valueKind,
    emptyValue: typeof emptyValue === 'function' ? emptyValue : () => emptyValue,
  }
}

function isMultiple(data: PropertyBag): boolean {
  return data.multiple === true
}

function singleOrList(data: PropertyBag): ValueKind {
  return isMultiple(data) ? 'string-list' : 'string'
}

function nullOrEmptyList(data: PropertyBag): JsonValue {
  return isMultiple(data) ? [] : null
}

/** 内置字段种类。 */
export const BUILTIN_FIELDS: readonly FieldKindDefinition[] = [
  field({
    kind: 'text',
    category: 'input',
    element: 'xh-text-field',
    placeholder: true,
    data: [{ path: ['inputType'], control: { kind: 'select', options: [{ value: 'text' }, { value: 'email' }, { value: 'tel' }, { value: 'url' }] }, default: 'text' }],
    appearance: AFFIXES,
    validations: TEXT_RULES,
    valueKind: 'string',
    emptyValue: '',
  }),
  field({
    kind: 'textarea',
    category: 'input',
    element: 'xh-text-field',
    placeholder: true,
    appearance: [
      { path: ['minRows'], control: { kind: 'number', integer: true, min: 1, max: 50 }, default: 3 },
      { path: ['maxRows'], control: { kind: 'number', integer: true, min: 1, max: 50 } },
    ],
    validations: TEXT_RULES,
    valueKind: 'string',
    emptyValue: '',
  }),
  field({
    kind: 'mention',
    category: 'input',
    element: 'xh-mention',
    placeholder: true,
    data: [OPTIONS, OPTION_SOURCE, OPTION_DEPENDENCIES, { path: ['triggerPrefix'], control: { kind: 'text' }, default: '@' }],
    validations: TEXT_RULES,
    valueKind: 'string',
    emptyValue: '',
  }),
  field({
    kind: 'password',
    category: 'input',
    element: 'xh-password-input',
    placeholder: true,
    validations: TEXT_RULES,
    valueKind: 'string',
    emptyValue: '',
  }),
  field({
    kind: 'number',
    category: 'input',
    element: 'xh-number-field',
    placeholder: true,
    data: [
      { path: ['step'], control: { kind: 'number' }, default: 1 },
      { path: ['precision'], control: { kind: 'number', integer: true, min: 0, max: 20 } },
    ],
    appearance: AFFIXES,
    validations: NUMBER_RULES,
    valueKind: 'number',
    emptyValue: null,
  }),
  field({
    kind: 'pin',
    category: 'input',
    element: 'xh-pin-input',
    placeholder: true,
    data: [
      { path: ['length'], control: { kind: 'number', integer: true, min: 1, max: 12 }, default: 6 },
      { path: ['mask'], control: { kind: 'boolean' }, default: false },
    ],
    validations: TEXT_RULES,
    valueKind: 'string',
    emptyValue: '',
  }),
  field({
    kind: 'select',
    category: 'choice',
    element: 'xh-select',
    placeholder: true,
    data: [OPTIONS, OPTION_SOURCE, OPTION_DEPENDENCIES, MULTIPLE],
    validations: CHOICE_RULES,
    valueKind: singleOrList,
    emptyValue: nullOrEmptyList,
  }),
  field({
    kind: 'combobox',
    category: 'choice',
    element: 'xh-combobox',
    placeholder: true,
    data: [OPTIONS, OPTION_SOURCE, OPTION_DEPENDENCIES, MULTIPLE],
    validations: CHOICE_RULES,
    valueKind: singleOrList,
    emptyValue: nullOrEmptyList,
  }),
  field({
    kind: 'cascader',
    category: 'choice',
    element: 'xh-cascader',
    placeholder: true,
    data: [TREE_OPTIONS, OPTION_SOURCE, OPTION_DEPENDENCIES, MULTIPLE],
    validations: CHOICE_RULES,
    valueKind: data => (isMultiple(data) ? 'list' : 'string-list'),
    emptyValue: [],
  }),
  field({
    kind: 'tree-select',
    category: 'choice',
    element: 'xh-tree-select',
    placeholder: true,
    data: [TREE_OPTIONS, OPTION_SOURCE, OPTION_DEPENDENCIES, MULTIPLE],
    validations: CHOICE_RULES,
    valueKind: singleOrList,
    emptyValue: nullOrEmptyList,
  }),
  field({
    kind: 'radio-group',
    category: 'choice',
    element: 'xh-radio-group',
    data: [OPTIONS, OPTION_SOURCE, OPTION_DEPENDENCIES],
    appearance: [ORIENTATION],
    validations: PLAIN_RULES,
    valueKind: 'string',
    emptyValue: null,
  }),
  field({
    kind: 'checkbox-group',
    category: 'choice',
    element: 'xh-checkbox-group',
    data: [OPTIONS, OPTION_SOURCE, OPTION_DEPENDENCIES],
    appearance: [ORIENTATION],
    validations: CHOICE_RULES,
    valueKind: 'string-list',
    emptyValue: [],
  }),
  field({
    kind: 'toggle-group',
    category: 'choice',
    element: 'xh-toggle-group',
    readOnly: false,
    data: [OPTIONS, OPTION_SOURCE, OPTION_DEPENDENCIES, MULTIPLE],
    validations: CHOICE_RULES,
    valueKind: singleOrList,
    emptyValue: nullOrEmptyList,
  }),
  field({
    kind: 'listbox',
    category: 'choice',
    element: 'xh-listbox',
    data: [OPTIONS, OPTION_SOURCE, OPTION_DEPENDENCIES, MULTIPLE],
    validations: CHOICE_RULES,
    valueKind: singleOrList,
    emptyValue: nullOrEmptyList,
  }),
  field({
    kind: 'tag-group',
    category: 'choice',
    element: 'xh-tag-group',
    data: [OPTIONS, OPTION_SOURCE, OPTION_DEPENDENCIES, MULTIPLE],
    validations: CHOICE_RULES,
    valueKind: singleOrList,
    emptyValue: nullOrEmptyList,
  }),
  field({
    kind: 'transfer',
    category: 'choice',
    element: 'xh-transfer',
    data: [OPTIONS, OPTION_SOURCE, OPTION_DEPENDENCIES],
    validations: CHOICE_RULES,
    valueKind: 'string-list',
    emptyValue: [],
  }),
  field({
    kind: 'checkbox',
    category: 'choice',
    element: 'xh-checkbox',
    validations: BOOLEAN_RULES,
    valueKind: 'boolean',
    emptyValue: false,
  }),
  field({
    kind: 'switch',
    category: 'choice',
    element: 'xh-switch',
    validations: BOOLEAN_RULES,
    valueKind: 'boolean',
    emptyValue: false,
  }),
  field({
    kind: 'date',
    category: 'datetime',
    element: 'xh-date-picker',
    placeholder: true,
    data: [WITH_TIME],
    validations: PLAIN_RULES,
    valueKind: 'string',
    emptyValue: null,
  }),
  field({
    kind: 'date-range',
    category: 'datetime',
    element: 'xh-date-range-picker',
    placeholder: true,
    data: [WITH_TIME],
    validations: PLAIN_RULES,
    valueKind: 'string-list',
    emptyValue: [],
  }),
  field({
    kind: 'time',
    category: 'datetime',
    element: 'xh-time-picker',
    data: [WITH_SECONDS],
    validations: PLAIN_RULES,
    valueKind: 'string',
    emptyValue: null,
  }),
  field({
    kind: 'time-range',
    category: 'datetime',
    element: 'xh-time-range-picker',
    data: [WITH_SECONDS],
    validations: PLAIN_RULES,
    valueKind: 'string-list',
    emptyValue: [],
  }),
  field({
    kind: 'slider',
    category: 'advanced',
    element: 'xh-slider',
    data: [
      { path: ['min'], control: { kind: 'number' }, default: 0 },
      { path: ['max'], control: { kind: 'number' }, default: 100 },
      { path: ['step'], control: { kind: 'number' }, default: 1 },
      { path: ['range'], control: { kind: 'boolean' }, default: false },
    ],
    validations: NUMBER_RULES,
    valueKind: data => (data.range === true ? 'number-list' : 'number'),
    emptyValue: data => (data.range === true ? [] : null),
  }),
  field({
    kind: 'rating',
    category: 'advanced',
    element: 'xh-rating',
    data: [
      { path: ['count'], control: { kind: 'number', integer: true, min: 1, max: 10 }, default: 5 },
      { path: ['allowHalf'], control: { kind: 'boolean' }, default: false },
    ],
    validations: NUMBER_RULES,
    valueKind: 'number',
    emptyValue: null,
  }),
  field({
    kind: 'color',
    category: 'advanced',
    element: 'xh-color-picker',
    data: [
      { path: ['format'], control: { kind: 'select', options: [{ value: 'hex' }, { value: 'rgba' }, { value: 'hsla' }, { value: 'oklch' }] }, default: 'hex' },
      { path: ['swatches'], control: { kind: 'tags' }, default: [] },
    ],
    appearance: [{ path: ['display'], control: { kind: 'select', options: [{ value: 'picker' }, { value: 'swatches' }] }, default: 'picker' }],
    validations: PLAIN_RULES,
    valueKind: 'string',
    emptyValue: null,
  }),
  field({
    kind: 'tags',
    category: 'advanced',
    element: 'xh-tags-input',
    placeholder: true,
    data: [{ path: ['max'], control: { kind: 'number', integer: true, min: 1, max: 1000 } }],
    validations: CHOICE_RULES,
    valueKind: 'string-list',
    emptyValue: [],
  }),
  field({
    kind: 'file',
    category: 'advanced',
    element: 'xh-file-upload',
    readOnly: false,
    data: [
      { path: ['accept'], control: { kind: 'text' } },
      { path: ['maxFiles'], control: { kind: 'number', integer: true, min: 1, max: 100 } },
      { path: ['uploadTarget'], control: { kind: 'text' } },
    ],
    validations: CHOICE_RULES,
    valueKind: 'list',
    emptyValue: [],
  }),
  field({
    kind: 'signature',
    category: 'advanced',
    element: 'xh-signature-pad',
    validations: PLAIN_RULES,
    valueKind: 'object',
    emptyValue: null,
  }),
]
