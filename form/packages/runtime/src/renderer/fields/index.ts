/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 内置字段渲染器表：按种类取，宿主经 fieldRenderers 覆盖或新增。

import type { FieldRenderer } from '../types'
import { checkboxField, checkboxGroupField, comboboxField, radioGroupField, selectField, switchField, toggleGroupField } from './choice'
import { fileField } from './file'
import { ratingField, sliderField } from './measure'
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
  'radio-group': radioGroupField,
  'checkbox-group': checkboxGroupField,
  'toggle-group': toggleGroupField,
  'checkbox': checkboxField,
  'switch': switchField,
  'slider': sliderField,
  'rating': ratingField,
  'tags': tagsField,
  'file': fileField,
})
