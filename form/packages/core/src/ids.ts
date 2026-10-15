/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// id 与字段键的生成接口，以及一个按序号递增的实现。

/** id 来源：由宿主注入。`nextId` 产出节点、区域、规则的 id，必须在一份文档内唯一。 */
export interface IdSource {
  readonly nextId: () => string
}

/** 按序号递增的 id 来源：`<prefix>1`、`<prefix>2`……同一个实例从不重复，不同实例互不影响。 */
export function createSequentialIds(prefix = 'n', start = 1): IdSource {
  if (!Number.isSafeInteger(start) || start < 0)
    throw new TypeError('start 必须是非负整数')
  let counter = start
  return Object.freeze({
    nextId: () => `${prefix}${counter++}`,
  })
}
