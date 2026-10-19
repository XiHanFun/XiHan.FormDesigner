/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 历史记录面板：designer-shell 的面板工厂接上表单编辑模型的撤销历史，快照与跳转都经它的历史栈。

import type { FormDesignerContext } from './commands'
import { snapshotHistory } from '@xihan-ui/designer-kit'
import { createHistoryPanel } from '@xihan-ui/designer-shell'
import { HistoryIcon } from '@xihan-ui/icons'
import { internalsOf } from './internals'

/**
 * 历史记录面板：缺省在右栏属性下面、缺省隐藏，从「面板」菜单打开；面板头是清空历史。
 * 选一行跳到那一步，只读或正在拖动跨度时不跳；跳到以后经外框的 announce 播报。
 */
export const FORM_HISTORY_PANEL = createHistoryPanel<FormDesignerContext>({
  snapshot: ({ designer }) => snapshotHistory(internalsOf(designer).history()),
  goTo: ({ designer }, position) => {
    const history = internalsOf(designer).history()
    if (designer.readonly !== true && !history.inTransaction)
      history.goTo(position)
  },
  announce: ({ frame }, message) => frame?.announce(message),
}, {
  region: { icon: HistoryIcon },
  readonly: ({ designer }) => designer.readonly === true,
})
