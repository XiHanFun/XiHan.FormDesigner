/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @xihan-form/runtime/locale —— 表单的内建语言包，语言与 UI 的内建语言包一一对应。
//
// 每份含渲染器、设计器与设计器零件（designer-shell）的文案，宿主用 mergeXhConfig 与 UI 同一语言的
// 语言包合并后交给 setXhConfig 或 <xh-config>。每种语言是独立的具名导出，打包器按引用摇树。

import type {} from '../designer-translations'
import type {} from '../translations'

export { formDeDE } from './de-DE'
export { formEnUS } from './en-US'
export { formEsES } from './es-ES'
export { formFrFR } from './fr-FR'
export { formJaJP } from './ja-JP'
export { formKoKR } from './ko-KR'
export { formPtBR } from './pt-BR'
export { formRuRU } from './ru-RU'
export { formZhCN } from './zh-CN'
export { formZhTW } from './zh-TW'
