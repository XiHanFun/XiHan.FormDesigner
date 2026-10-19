/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 内置命令要用、但不进设计器公开 API 的操作：设计器建好时按实例登记，命令经上下文里的设计器取回。

import type { FormDocument, FormOperation, KindRegistry } from '@xihan-form/core'
import type { History, TableAxis } from '@xihan-ui/designer-kit'
import type { DesignerHistoryConfirm, DesignerHistoryTranslations } from '@xihan-ui/designer-shell'
import type { FormEditor } from './editor'

/** 设计态或预览态。 */
export type FormDesignerMode = 'design' | 'preview'

/** 一个设计器实例交给内置命令的操作。 */
export interface FormDesignerInternals {
  /** 按扩展合出的种类登记表。 */
  readonly registry: () => KindRegistry
  /** 切换设计态与预览态，变了时派发 mode-change。 */
  readonly setMode: (mode: FormDesignerMode) => void
  /** 派发 save。 */
  readonly save: () => void
  /** 选中所选节点或区域所在的容器。 */
  readonly selectParent: () => void
  /** 把唯一选中的节点在同一层里上移（-1）或下移（1）一位。 */
  readonly moveSelected: (step: -1 | 1) => void
  /** 合并选中的单元格。 */
  readonly mergeCells: () => void
  /** 拆开选中的单元格。 */
  readonly splitCell: () => void
  /** 在选中的单元格之前或之后插入一行或一列。 */
  readonly insertTableLine: (axis: TableAxis, after: boolean) => void
  /** 删除选中的单元格所在的行或列。 */
  readonly removeTableLine: (axis: TableAxis) => void
  /** 编辑模型的撤销历史，历史命令读写它。 */
  readonly history: () => History<FormDocument, FormOperation>
  /** 历史记录的文案：designer-shell 语言包的 xh-designer-history。 */
  readonly historyTranslations: () => DesignerHistoryTranslations
  /** 弹确认框，按确定时兑现为 true。 */
  readonly confirm: (options: DesignerHistoryConfirm) => Promise<boolean>
  /** 编辑模型：页面结构判定与执行挪动用。 */
  readonly editor: () => FormEditor
  /** 在画布上标出节点或区域，null 撤掉；不改选择、不滚动。 */
  readonly highlight: (id: string | null) => void
  /** 把区域亮出来：切到它所在的标签页、展开所在的折叠项，再滚进可见区。 */
  readonly revealRegion: (id: string) => void
}

const INTERNALS = new WeakMap<object, FormDesignerInternals>()

/** 设计器建好时登记自己的操作。 */
export function provideInternals(designer: object, internals: FormDesignerInternals): void {
  INTERNALS.set(designer, internals)
}

/** 取回设计器登记的操作；不是表单设计器时抛 TypeError。 */
export function internalsOf(designer: object): FormDesignerInternals {
  const internals = INTERNALS.get(designer)
  if (internals === undefined)
    throw new TypeError('[xh] 命令上下文里的 designer 不是 <xh-form-designer>')
  return internals
}
