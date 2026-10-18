<script setup lang="ts">
/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 示例舞台：在浏览器里载入 examples/demos/<name>.ts 或 <name>.vue。.ts 示例导出 mount，挂到舞台上，卸载时调用它返回的清理函数；
// .vue 示例是一个组件，直接渲染在舞台里。写了 fullscreen 的示例可以全屏，全屏时舞台里的设计器长到屏幕底。

import type { Component } from 'vue'
import { XhFullscreen } from '@xihanfun/vitepress-theme'
import { markRaw, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

interface DemoModule {
  mount?: (host: HTMLElement) => () => void
  default?: Component
}

const props = defineProps<{ name: string, fullscreen?: boolean }>()

const demos = import.meta.glob<DemoModule>('../../examples/demos/*.{ts,vue}')
const stage = ref<HTMLElement>()
const component = shallowRef<Component>()
const missing = ref(false)
let dispose: (() => void) | undefined
let stopFullscreen: (() => void) | undefined
let unmounted = false

/** 全屏时舞台里的设计器从自己的顶边长到舞台底，退出全屏后回到样式表给的高度。 */
function fillDesigners(host: HTMLElement): () => void {
  const fill = (): void => {
    const full = document.fullscreenElement?.contains(host) === true
    const bottom = host.getBoundingClientRect().bottom
    for (const designer of host.querySelectorAll<HTMLElement>('xh-form-designer'))
      designer.style.blockSize = full ? `${Math.floor(bottom - designer.getBoundingClientRect().top)}px` : ''
  }
  const observer = new ResizeObserver(fill)
  observer.observe(host)
  document.addEventListener('fullscreenchange', fill)
  return () => {
    observer.disconnect()
    document.removeEventListener('fullscreenchange', fill)
  }
}

onMounted(async () => {
  const load = demos[`../../examples/demos/${props.name}.ts`] ?? demos[`../../examples/demos/${props.name}.vue`]
  if (load === undefined) {
    missing.value = true
    return
  }
  const demo = await load()
  if (unmounted)
    return
  if (props.fullscreen && stage.value !== undefined)
    stopFullscreen = fillDesigners(stage.value)
  if (demo.mount !== undefined && stage.value !== undefined)
    dispose = demo.mount(stage.value)
  else if (demo.default !== undefined)
    component.value = markRaw(demo.default)
})

onBeforeUnmount(() => {
  unmounted = true
  stopFullscreen?.()
  dispose?.()
})
</script>

<template>
  <div class="form-demo">
    <p v-if="missing" class="form-demo__missing">
      找不到示例 {{ props.name }}
    </p>
    <XhFullscreen v-else-if="props.fullscreen">
      <div ref="stage" class="form-demo__stage">
        <component :is="component" v-if="component" />
      </div>
    </XhFullscreen>
    <div v-else ref="stage" class="form-demo__stage">
      <component :is="component" v-if="component" />
    </div>
  </div>
</template>
