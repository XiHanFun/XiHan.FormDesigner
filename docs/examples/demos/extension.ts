/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 扩展：设计器装上「身份证号」扩展，物料里多出这个种类，放进画布后问题列表给出警告，工具栏末尾多一条复制 JSON。

import { defineFormDesigner } from '@xihan-form/designer'
import { idCard } from '../extensions/id-card'
import { schema } from '../templates/contact'

defineFormDesigner()

export function mount(host: HTMLElement): () => void {
  // #region use
  const designer = document.createElement('xh-form-designer')
  designer.extensions = [idCard]
  designer.schema = schema
  // #endregion use
  host.append(designer)
  return () => host.replaceChildren()
}
