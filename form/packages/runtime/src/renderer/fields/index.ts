/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 内置字段渲染器表：按种类取；扩展经 fieldRenderers 给新种类登记渲染，种类名与这里的重名时合并报冲突。

import type { FieldRenderer } from '../types'
import { cascaderField, checkboxField, checkboxGroupField, comboboxField, radioGroupField, selectField, switchField, toggleGroupField, transferField, treeSelectField } from './choice'
import { colorField } from './color'
import { dateField, dateRangeField, timeField } from './datetime'
import { fileField } from './file'
import { ratingField, sliderField } from './measure'
import { signatureField } from './signature'
import { numberField, passwordField, pinField, tagsField, textareaField, textField } from './text'

/** 内置字段种类的渲染器。 */
export const FORM_FIELD_RENDERERS: Readonly<Record<string, FieldRenderer>> = Object.freeze({
  'text': textField,
  'textarea': textareaField,
  'password': passwordField,
  'number': numberField,
  'pin': pinField,
  'select': selectField,
  'combobox': comboboxField,
  'tree-select': treeSelectField,
  'cascader': cascaderField,
  'radio-group': radioGroupField,
  'checkbox-group': checkboxGroupField,
  'toggle-group': toggleGroupField,
  'transfer': transferField,
  'checkbox': checkboxField,
  'switch': switchField,
  'date': dateField,
  'date-range': dateRangeField,
  'time': timeField,
  'slider': sliderField,
  'rating': ratingField,
  'color': colorField,
  'tags': tagsField,
  'file': fileField,
  'signature': signatureField,
})
