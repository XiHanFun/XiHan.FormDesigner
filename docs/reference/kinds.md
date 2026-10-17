# 种类与属性

<!-- 本页由 docs/scripts/gen-reference.mjs 从源码生成，不要手改；源码变了之后在 docs/ 运行 pnpm gen。 -->

内置种类按物料面板的分类列出。属性写成所在属性包里的路径（如 `basic.label` 即节点的 `basic` 里的 `label`）；「名称」是属性面板里的中文名；「新建时」是在设计器里新建节点时写入的值，过长的值以 … 代替。

每个节点还有共有字段 `type`、`id`、`kind`、`validation`（静态元素没有）、`linkage` 与 `extensions`；字段与列表容器另有数据键 `key`，容器另有区域 `regions`。见[模板类型](./schema)。

## 表单设置 {#settings}

没有选中节点时，属性面板编辑表单设置，存放在文档的 `settings` 里。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `settings.labelPlacement` | 标签位置 | `top` 上方、`start` 左侧 | `"top"` |
| `settings.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |
| `settings.disabled` | 禁用 | 布尔 | `false` |
| `settings.readOnly` | 只读 | 布尔 | `false` |

## 输入 {#category-input}

### 单行文本 `text` {#text}

字段 · 渲染为 `<xh-text-field>` · 值：字符串，空值 `""` · 适用的校验：必填、长度、正则、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.placeholder` | 占位符 | 文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `data.inputType` | 输入类型 | `text` 文本、`email` 邮箱、`tel` 电话、`url` 网址 | `"text"` |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |
| `appearance.prefix` | 前缀 | 文本 | — |
| `appearance.suffix` | 后缀 | 文本 | — |

### 多行文本 `textarea` {#textarea}

字段 · 渲染为 `<xh-text-field>` · 值：字符串，空值 `""` · 适用的校验：必填、长度、正则、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.placeholder` | 占位符 | 文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |
| `appearance.minRows` | 最少行数 | 整数，≥ 1，≤ 50 | `3` |
| `appearance.maxRows` | 最多行数 | 整数，≥ 1，≤ 50 | — |

### 密码 `password` {#password}

字段 · 渲染为 `<xh-password-input>` · 值：字符串，空值 `""` · 适用的校验：必填、长度、正则、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.placeholder` | 占位符 | 文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

### 数字 `number` {#number}

字段 · 渲染为 `<xh-number-field>` · 值：数值，空值 `null` · 适用的校验：必填、范围、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.placeholder` | 占位符 | 文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `data.step` | 步长 | 数值 | `1` |
| `data.precision` | 小数位数 | 整数，≥ 0，≤ 20 | — |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |
| `appearance.prefix` | 前缀 | 文本 | — |
| `appearance.suffix` | 后缀 | 文本 | — |

### 验证码 `pin` {#pin}

字段 · 渲染为 `<xh-pin-input>` · 值：字符串，空值 `""` · 适用的校验：必填、长度、正则、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.placeholder` | 占位符 | 文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `data.length` | 位数 | 整数，≥ 1，≤ 12 | `6` |
| `data.mask` | 遮挡输入 | 布尔 | `false` |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

## 选择 {#category-choice}

### 下拉选择 `select` {#select}

字段 · 渲染为 `<xh-select>` · 值：字符串（打开「多选」时为字符串数组），空值 `null` · 适用的校验：必填、长度、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.placeholder` | 占位符 | 文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `data.options` | 选项 | [选项](./schema#options)数组 | `[]` |
| `data.optionSource` | 选项来源 | 文本 | — |
| `data.optionDependencies` | 选项依赖 | 字符串数组 | — |
| `data.multiple` | 多选 | 布尔 | `false` |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

### 可输入下拉 `combobox` {#combobox}

字段 · 渲染为 `<xh-combobox>` · 值：字符串（打开「多选」时为字符串数组），空值 `null` · 适用的校验：必填、长度、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.placeholder` | 占位符 | 文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `data.options` | 选项 | [选项](./schema#options)数组 | `[]` |
| `data.optionSource` | 选项来源 | 文本 | — |
| `data.optionDependencies` | 选项依赖 | 字符串数组 | — |
| `data.multiple` | 多选 | 布尔 | `false` |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

### 级联选择 `cascader` {#cascader}

字段 · 渲染为 `<xh-cascader>` · 值：字符串数组（打开「多选」时为数组），空值 `[]` · 适用的校验：必填、长度、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.placeholder` | 占位符 | 文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `data.options` | 选项 | [选项](./schema#options)树，每项可带 `children` 与 `hasChildren` | `[]` |
| `data.optionSource` | 选项来源 | 文本 | — |
| `data.optionDependencies` | 选项依赖 | 字符串数组 | — |
| `data.multiple` | 多选 | 布尔 | `false` |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

### 树选择 `tree-select` {#tree-select}

字段 · 渲染为 `<xh-tree-select>` · 值：字符串（打开「多选」时为字符串数组），空值 `null` · 适用的校验：必填、长度、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.placeholder` | 占位符 | 文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `data.options` | 选项 | [选项](./schema#options)树，每项可带 `children` 与 `hasChildren` | `[]` |
| `data.optionSource` | 选项来源 | 文本 | — |
| `data.optionDependencies` | 选项依赖 | 字符串数组 | — |
| `data.multiple` | 多选 | 布尔 | `false` |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

### 单选组 `radio-group` {#radio-group}

字段 · 渲染为 `<xh-radio-group>` · 值：字符串，空值 `null` · 适用的校验：必填、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `data.options` | 选项 | [选项](./schema#options)数组 | `[]` |
| `data.optionSource` | 选项来源 | 文本 | — |
| `data.optionDependencies` | 选项依赖 | 字符串数组 | — |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |
| `appearance.orientation` | 排列方向 | `horizontal` 横排、`vertical` 竖排 | `"horizontal"` |

### 多选组 `checkbox-group` {#checkbox-group}

字段 · 渲染为 `<xh-checkbox-group>` · 值：字符串数组，空值 `[]` · 适用的校验：必填、长度、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `data.options` | 选项 | [选项](./schema#options)数组 | `[]` |
| `data.optionSource` | 选项来源 | 文本 | — |
| `data.optionDependencies` | 选项依赖 | 字符串数组 | — |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |
| `appearance.orientation` | 排列方向 | `horizontal` 横排、`vertical` 竖排 | `"horizontal"` |

### 按钮组 `toggle-group` {#toggle-group}

字段 · 渲染为 `<xh-toggle-group>` · 值：字符串（打开「多选」时为字符串数组），空值 `null` · 适用的校验：必填、长度、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `data.options` | 选项 | [选项](./schema#options)数组 | `[]` |
| `data.optionSource` | 选项来源 | 文本 | — |
| `data.optionDependencies` | 选项依赖 | 字符串数组 | — |
| `data.multiple` | 多选 | 布尔 | `false` |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

### 穿梭框 `transfer` {#transfer}

字段 · 渲染为 `<xh-transfer>` · 值：字符串数组，空值 `[]` · 适用的校验：必填、长度、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `data.options` | 选项 | [选项](./schema#options)数组 | `[]` |
| `data.optionSource` | 选项来源 | 文本 | — |
| `data.optionDependencies` | 选项依赖 | 字符串数组 | — |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

### 勾选框 `checkbox` {#checkbox}

字段 · 渲染为 `<xh-checkbox>` · 值：布尔，空值 `false` · 适用的校验：必填、必须勾选、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

### 开关 `switch` {#switch}

字段 · 渲染为 `<xh-switch>` · 值：布尔，空值 `false` · 适用的校验：必填、必须勾选、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

## 日期时间 {#category-datetime}

### 日期 `date` {#date}

字段 · 渲染为 `<xh-date-picker>` · 值：字符串，空值 `null` · 适用的校验：必填、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.placeholder` | 占位符 | 文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `data.withTime` | 带时间 | 布尔 | `false` |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

### 日期范围 `date-range` {#date-range}

字段 · 渲染为 `<xh-date-range-picker>` · 值：字符串数组，空值 `[]` · 适用的校验：必填、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.placeholder` | 占位符 | 文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `data.withTime` | 带时间 | 布尔 | `false` |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

### 时间 `time` {#time}

字段 · 渲染为 `<xh-time-picker>` · 值：字符串，空值 `null` · 适用的校验：必填、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `data.withSeconds` | 带秒 | 布尔 | `false` |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

### 时间范围 `time-range` {#time-range}

字段 · 内置渲染器不渲染这个种类，模板里用到它时渲染器派发 `schema-error`（`XH_FORM_RT_NO_RENDERER`），可以经扩展的 `fieldRenderers` 补上 · 值：字符串数组，空值 `[]` · 适用的校验：必填、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `data.withSeconds` | 带秒 | 布尔 | `false` |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

## 高级 {#category-advanced}

### 滑块 `slider` {#slider}

字段 · 渲染为 `<xh-slider>` · 值：数值（打开「区间」时为数值数组），空值 `null` · 适用的校验：必填、范围、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `data.min` | 最小值 | 数值 | `0` |
| `data.max` | 最大值 | 数值 | `100` |
| `data.step` | 步长 | 数值 | `1` |
| `data.range` | 区间 | 布尔 | `false` |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

### 评分 `rating` {#rating}

字段 · 渲染为 `<xh-rating>` · 值：数值，空值 `null` · 适用的校验：必填、范围、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `data.count` | 星数 | 整数，≥ 1，≤ 10 | `5` |
| `data.allowHalf` | 允许半星 | 布尔 | `false` |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

### 颜色 `color` {#color}

字段 · 渲染为 `<xh-color-picker>` · 值：字符串，空值 `null` · 适用的校验：必填、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `data.format` | 格式 | `hex`、`rgba`、`hsla`、`oklch` | `"hex"` |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

### 标签 `tags` {#tags}

字段 · 渲染为 `<xh-tags-input>` · 值：字符串数组，空值 `[]` · 适用的校验：必填、长度、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.placeholder` | 占位符 | 文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `data.max` | 最大值 | 整数，≥ 1，≤ 1000 | — |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

### 文件 `file` {#file}

字段 · 渲染为 `<xh-file-upload>` · 值：数组，空值 `[]` · 适用的校验：必填、长度、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `data.accept` | 允许的类型 | 文本 | — |
| `data.maxFiles` | 最多文件数 | 整数，≥ 1，≤ 100 | — |
| `data.uploadTarget` | 上传位置 | 文本 | — |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

### 签名 `signature` {#signature}

字段 · 渲染为 `<xh-signature-pad>` · 值：对象，空值 `null` · 适用的校验：必填、表达式 · 联动动作：显示、隐藏、启用、禁用、必填、选填、赋值。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | `""` |
| `basic.hint` | 提示 | 多行文本 | — |
| `basic.initialValue` | 初始值 | 任意 JSON 值，形状随字段的值 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `basic.readOnly` | 只读 | 布尔 | `false` |
| `appearance.labelHidden` | 隐藏标签 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

## 布局 {#category-layout}

### 栅格 `grid` {#grid}

容器 · 渲染为 `<xh-grid>` · 只管排版，对数据透明 · 区域 1 个起、最多 12 个 · 区域里能放任意节点 · 联动动作：显示、隐藏、启用、禁用。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `appearance.gap` | 间距 | `xs` 极小、`sm` 小、`md` 中、`lg` 大、`xl` 极大 | `"md"` |

区域属性，存放在各区域的 `props` 里：

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `props.span` | 跨列 | 整数，≥ 1，≤ 12 | `6` |
| `props.offset` | 左侧留空 | 整数，≥ 0，≤ 11 | — |

### 标签页 `tabs` {#tabs}

容器 · 渲染为 `<xh-tabs>` · 只管排版，对数据透明 · 区域 1 个起、不限上限 · 区域里能放任意节点 · 联动动作：显示、隐藏、启用、禁用。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |

区域属性，存放在各区域的 `props` 里：

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `props.title` | 标题 | 文本 | `""` |

### 卡片 `card` {#card}

容器 · 渲染为 `<xh-card>` · 只管排版，对数据透明 · 区域固定 1 个 · 区域里能放任意节点 · 联动动作：显示、隐藏、启用、禁用。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.title` | 标题 | 文本 | `""` |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |

### 折叠面板 `collapse` {#collapse}

容器 · 渲染为 `<xh-accordion>` · 只管排版，对数据透明 · 区域 1 个起、不限上限 · 区域里能放任意节点 · 联动动作：显示、隐藏、启用、禁用。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `appearance.multiple` | 多选 | 布尔 | `true` |

区域属性，存放在各区域的 `props` 里：

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `props.title` | 标题 | 文本 | `""` |
| `props.expanded` | 默认展开 | 布尔 | `true` |

### 分组 `fieldset` {#fieldset}

容器 · 渲染为 `<xh-fieldset>` · 只管排版，对数据透明 · 区域固定 1 个 · 区域里能放任意节点 · 联动动作：显示、隐藏、启用、禁用。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.legend` | 分组标题 | 文本 | `""` |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |

### 表格布局 `table` {#table}

容器 · 渲染为 `<xh-grid>` · 只管排版，对数据透明 · 区域 1 个起、不限上限 · 区域里能放任意节点 · 联动动作：显示、隐藏、启用、禁用。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `appearance.rows` | 行数 | 整数，≥ 1，≤ 100 | `2` |
| `appearance.columns` | 列数 | 整数，≥ 1，≤ 12 | `2` |
| `appearance.bordered` | 显示格线 | 布尔 | `true` |

区域属性，存放在各区域的 `props` 里：

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `props.row` | 行 | 整数，≥ 0，≤ 99 | `0` |
| `props.column` | 列 | 整数，≥ 0，≤ 11 | `0` |
| `props.rowSpan` | 跨行 | 整数，≥ 1，≤ 100 | `1` |
| `props.columnSpan` | 跨列 | 整数，≥ 1，≤ 12 | `1` |

## 数据 {#category-data}

### 子表单 `subform` {#subform}

容器 · 渲染为 `<xh-field-array>` · 带数据键，值是行对象的数组 · 区域固定 1 个 · 区域里能放任意节点 · 适用的校验：必填、长度、表达式 · 联动动作：显示、隐藏、启用、禁用。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.title` | 标题 | 文本 | `""` |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `data.initialRows` | 初始行数 | 整数，≥ 0，≤ 100 | `0` |
| `data.movable` | 可调整行序 | 布尔 | `true` |

### 子表 `subtable` {#subtable}

容器 · 渲染为 `<xh-field-array>` · 带数据键，值是行对象的数组 · 区域固定 1 个 · 区域里只能放字段 · 适用的校验：必填、长度、表达式 · 联动动作：显示、隐藏、启用、禁用。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.title` | 标题 | 文本 | `""` |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `basic.disabled` | 禁用 | 布尔 | `false` |
| `data.initialRows` | 初始行数 | 整数，≥ 0，≤ 100 | `0` |
| `data.movable` | 可调整行序 | 布尔 | `true` |

## 静态 {#category-static}

### 分隔线 `divider` {#divider}

静态元素 · 渲染为 `<xh-separator>` · 联动动作：显示、隐藏。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.label` | 标签 | 文本 | — |
| `basic.hidden` | 隐藏 | 布尔 | `false` |

### 段落 `paragraph` {#paragraph}

静态元素 · 渲染为 `<xh-typography>` · 联动动作：显示、隐藏。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.content` | 内容 | 多行文本 | `""` |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `appearance.size` | 尺寸 | `sm` 小、`md` 中、`lg` 大 | `"md"` |

### 标题 `heading` {#heading}

静态元素 · 渲染为 `<xh-typography>` · 联动动作：显示、隐藏。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.content` | 内容 | 文本 | `""` |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `appearance.level` | 级别 | `2` 二级、`3` 三级、`4` 四级、`5` 五级、`6` 六级 | `3` |

### 提示 `alert` {#alert}

静态元素 · 渲染为 `<xh-alert>` · 联动动作：显示、隐藏。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.title` | 标题 | 文本 | `""` |
| `basic.content` | 内容 | 多行文本 | `""` |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `appearance.tone` | 语气 | `info` 信息、`success` 成功、`warning` 警告、`danger` 危险、`neutral` 中性 | `"info"` |

### 图片 `image` {#image}

静态元素 · 渲染为 `<xh-image>` · 联动动作：显示、隐藏。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.src` | 图片地址 | 文本 | `""` |
| `basic.alt` | 替代文本 | 文本 | `""` |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `appearance.width` | 宽度 | 整数，≥ 16，≤ 4096 | — |

### 条码 `barcode` {#barcode}

静态元素 · 渲染为 `<xh-bar-code>` · 联动动作：显示、隐藏。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.value` | 编码内容 | 文本 | `""` |
| `basic.format` | 码制 | `code128`、`ean13`、`ean8`、`upca`、`upce`、`itf14`、`code39` | `"code128"` |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
| `appearance.showText` | 显示文字 | 布尔 | `true` |

### 二维码 `qrcode` {#qrcode}

静态元素 · 渲染为 `<xh-matrix-code>` · 联动动作：显示、隐藏。

| 属性 | 名称 | 取值 | 新建时 |
| --- | --- | --- | --- |
| `basic.value` | 编码内容 | 文本 | `""` |
| `basic.format` | 码制 | `qr` QR 码、`data-matrix` Data Matrix、`pdf417` PDF417、`aztec` Aztec | `"qr"` |
| `basic.hidden` | 隐藏 | 布尔 | `false` |
