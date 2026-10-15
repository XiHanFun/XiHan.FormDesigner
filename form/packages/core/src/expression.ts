/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表单的运行时变量；表达式引擎由宿主注入，求值与条件判定取 @xihan-ui/expression 的 evaluateSource 与 conditionOf。

/** 运行时变量：当前字段的值、所在行与行号。 */
export const RUNTIME_VARIABLES = Object.freeze({
  value: '$value',
  row: '$row',
  index: '$index',
})
