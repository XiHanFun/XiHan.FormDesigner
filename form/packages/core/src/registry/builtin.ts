/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 内置种类汇总，以及含内置种类的登记表。

import type { KindDefinition, KindRegistry } from './kinds'
import { BUILTIN_CONTAINERS, BUILTIN_STATICS } from './builtin-containers'
import { BUILTIN_FIELDS } from './builtin-fields'
import { createKindRegistry } from './kinds'

/** 全部内置种类：字段、容器、静态元素。 */
export const BUILTIN_KINDS: readonly KindDefinition[] = [...BUILTIN_FIELDS, ...BUILTIN_CONTAINERS, ...BUILTIN_STATICS]

/** 创建含全部内置种类的登记表，`extra` 里的种类接在后面，名字不得与内置种类重复。 */
export function createBuiltinKindRegistry(extra: Iterable<KindDefinition> = []): KindRegistry {
  return createKindRegistry([...BUILTIN_KINDS, ...extra])
}
