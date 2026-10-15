/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 内置字段种类：每种对应一个 XiHan.UI 字段元素。

import type { JsonValue } from '@xihan-ui/core/json'
import type { PropertyBag, ValidationKind } from '../schema'
import type { FieldKindDefinition, ValueKind } from './kinds'
import type { PropertyDescriptor } from './properties'

const LABEL: PropertyDescriptor = { name: 'label', type: 'string', default: '' }
const HINT: PropertyDescriptor = { name: 'hint', type: 'text' }
const PLACEHOLDER: PropertyDescriptor = { name: 'placeholder', type: 'string' }
const INITIAL_VALUE: PropertyDescriptor = { name: 'initialValue', type: 'value' }
const HIDDEN: PropertyDescriptor = { name: 'hidden', type: 'boolean', default: false }
const DISABLED: PropertyDescriptor = { name: 'disabled', type: 'boolean', default: false }
const READ_ONLY: PropertyDescriptor = { name: 'readOnly', type: 'boolean', default: false }
const LABEL_HIDDEN: PropertyDescriptor = { name: 'labelHidden', type: 'boolean', default: false }
const SIZE: PropertyDescriptor = { name: 'size', type: 'enum', choices: ['sm', 'md', 'lg'], default: 'md' }
const OPTIONS: PropertyDescriptor = { name: 'options', type: 'options', default: [] }
const TREE_OPTIONS: PropertyDescriptor = { name: 'options', type: 'tree-options', default: [] }
const OPTION_SOURCE: PropertyDescriptor = { name: 'optionSource', type: 'string' }
const OPTION_DEPENDENCIES: PropertyDescriptor = { name: 'optionDependencies', type: 'string-list' }
const MULTIPLE: PropertyDescriptor = { name: 'multiple', type: 'boolean', default: false }
const ORIENTATION: PropertyDescriptor = { name: 'orientation', type: 'enum', choices: ['horizontal', 'vertical'], default: 'horizontal' }
const WITH_TIME: PropertyDescriptor = { name: 'withTime', type: 'boolean', default: false }
const WITH_SECONDS: PropertyDescriptor = { name: 'withSeconds', type: 'boolean', default: false }

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
  readonly data?: readonly PropertyDescriptor[]
  readonly appearance?: readonly PropertyDescriptor[]
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
      appearance: [LABEL_HIDDEN, SIZE, ...(spec.appearance ?? [])],
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
    data: [{ name: 'inputType', type: 'enum', choices: ['text', 'email', 'tel', 'url'], default: 'text' }],
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
      { name: 'minRows', type: 'integer', min: 1, max: 50, default: 3 },
      { name: 'maxRows', type: 'integer', min: 1, max: 50 },
    ],
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
    data: [
      { name: 'step', type: 'number', default: 1 },
      { name: 'precision', type: 'integer', min: 0, max: 20 },
    ],
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
      { name: 'length', type: 'integer', min: 1, max: 12, default: 6 },
      { name: 'mask', type: 'boolean', default: false },
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
      { name: 'min', type: 'number', default: 0 },
      { name: 'max', type: 'number', default: 100 },
      { name: 'step', type: 'number', default: 1 },
      { name: 'range', type: 'boolean', default: false },
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
      { name: 'count', type: 'integer', min: 1, max: 10, default: 5 },
      { name: 'allowHalf', type: 'boolean', default: false },
    ],
    validations: NUMBER_RULES,
    valueKind: 'number',
    emptyValue: null,
  }),
  field({
    kind: 'color',
    category: 'advanced',
    element: 'xh-color-picker',
    data: [{ name: 'format', type: 'enum', choices: ['hex', 'rgba', 'hsla', 'oklch'], default: 'hex' }],
    validations: PLAIN_RULES,
    valueKind: 'string',
    emptyValue: null,
  }),
  field({
    kind: 'tags',
    category: 'advanced',
    element: 'xh-tags-input',
    placeholder: true,
    data: [{ name: 'max', type: 'integer', min: 1, max: 1000 }],
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
      { name: 'accept', type: 'string' },
      { name: 'maxFiles', type: 'integer', min: 1, max: 100 },
      { name: 'uploadTarget', type: 'string' },
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
