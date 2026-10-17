/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 内置种类汇总：由内置扩展登记，见 extensions.ts 的 FORM_CORE_EXTENSION。

import type { KindDefinition } from './kinds'
import { BUILTIN_CONTAINERS, BUILTIN_STATICS } from './builtin-containers'
import { BUILTIN_FIELDS } from './builtin-fields'

/** 全部内置种类：字段、容器、静态元素。 */
export const BUILTIN_KINDS: readonly KindDefinition[] = [...BUILTIN_FIELDS, ...BUILTIN_CONTAINERS, ...BUILTIN_STATICS]
