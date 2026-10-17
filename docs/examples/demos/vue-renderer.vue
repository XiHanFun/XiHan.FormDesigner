<script setup lang="ts">
/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 在 Vue 里使用渲染器：对象经 .prop 交给元素的属性，事件用 @ 监听。

import type { FormRendererEventMap } from '@xihan-form/runtime'
import { defineFormRenderer } from '@xihan-form/runtime'
import { ref } from 'vue'
import { schema, values } from '../templates/contact'

defineFormRenderer()

const renderer = ref<HTMLElement & { submit: () => void }>()
const result = ref('')

function onSubmit(event: Event): void {
  result.value = JSON.stringify((event as FormRendererEventMap['submit']).detail.values)
}

function onInvalid(event: Event): void {
  result.value = `还有 ${(event as FormRendererEventMap['invalid']).detail.issues.length} 处没填对`
}
</script>

<template>
  <xh-form-renderer ref="renderer" :schema.prop="schema" :values.prop="values" @submit="onSubmit" @invalid="onInvalid" />
  <button type="button" @click="renderer?.submit()">
    提交
  </button>
  <pre>{{ result }}</pre>
</template>
