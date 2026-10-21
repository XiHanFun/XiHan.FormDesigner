# 写用例

- 先写会红的用例，确认它在改实现之前失败，再改实现。
- 用例在 `form/packages/<包>/tests/*.spec.ts`。core 的用例不碰 DOM；runtime 与 designer 的文件头写 `// @vitest-environment jsdom`。
- 表达式用 `tests/fake-engine.ts` 的 `createFakeEngine`：按源码查表给结果，`@@` 报语法错，给了名单时报不认识的名字。用例只证明表单怎么调引擎，不重测表达式语义。
- 设计器用例 mount 时设 `autoTour = false`，免得引导抢焦点；要测引导自动开始时，给画布的 `clientWidth` 打桩再 `requestUpdate`。
- 拖到画布：开始拖动后派发指针事件，并给 `document.elementFromPoint`、`elementsFromPoint` 打桩指到画布。
- 画布只在文档、扩展、文案变了或配置过期时重排，断言重排不要拿「这次没有变化」当条件。
- 编辑操作：断言结果与逆操作；无变化返回同一文档引用、逆操作为空；失败抛 `FormOperationError`。
- 比较 DOM 元素的先后时比较文字或标识，`toEqual` 按结构比较，两个不同的元素也可能判成相等。
- jsdom 里 textarea 的自动高度会抛错，单测里避开 textarea。
- 测试读的是 `@xihan-ui/*` 的 dist（npm 包）与上游表单包的 dist；看到整文件 `ERR_MODULE_NOT_FOUND` 先确认 `form/` 已 `pnpm build`。
