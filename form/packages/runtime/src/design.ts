/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// @xihan-form/runtime/design —— 设计器画布复用的渲染部件：字段外壳、容器与静态元素的部件树、值问题的文案。
// 主入口与 <xh-form-renderer> 不依赖它，体积不变。

export { CONTAINER_BUILDERS, STATIC_BUILDERS } from './renderer/containers'
export type { ContainerBuilder, ContainerView, StaticBuilder, StaticView } from './renderer/containers'
export { createFieldShell } from './renderer/field-shell'
export type { FieldShell } from './renderer/field-shell'
export { issueMessage } from './renderer/messages'
