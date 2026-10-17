/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 渲染器用到的库内元素：表单、字段外壳、内置字段与容器。按需注册，不全量注册 @xihan-ui/web-components。

import {
  defineXhElement,
  XhAccordionElement,
  XhAlertElement,
  XhBarCodeElement,
  XhCardElement,
  XhCheckboxElement,
  XhCheckboxGroupElement,
  XhComboboxElement,
  XhFieldArrayElement,
  XhFieldElement,
  XhFieldsetElement,
  XhFileUploadElement,
  XhFormElement,
  XhGridElement,
  XhImageElement,
  XhInputGroupElement,
  XhMatrixCodeElement,
  XhNumberFieldElement,
  XhPasswordInputElement,
  XhPinInputElement,
  XhRadioGroupElement,
  XhRatingElement,
  XhSelectElement,
  XhSeparatorElement,
  XhSliderElement,
  XhSwitchElement,
  XhTabsElement,
  XhTagsInputElement,
  XhTextFieldElement,
  XhToggleGroupElement,
  XhTreeSelectElement,
  XhTypographyElement,
} from '@xihan-ui/web-components/define'

/** 注册渲染器（与设计画布）建出的全部库内元素；重复调用不报错。 */
export function defineRendererElements(): void {
  defineXhElement('xh-form', XhFormElement)
  defineXhElement('xh-field', XhFieldElement)
  defineXhElement('xh-field-array', XhFieldArrayElement)
  defineXhElement('xh-text-field', XhTextFieldElement)
  defineXhElement('xh-input-group', XhInputGroupElement)
  defineXhElement('xh-password-input', XhPasswordInputElement)
  defineXhElement('xh-number-field', XhNumberFieldElement)
  defineXhElement('xh-pin-input', XhPinInputElement)
  defineXhElement('xh-tags-input', XhTagsInputElement)
  defineXhElement('xh-select', XhSelectElement)
  defineXhElement('xh-combobox', XhComboboxElement)
  defineXhElement('xh-tree-select', XhTreeSelectElement)
  defineXhElement('xh-radio-group', XhRadioGroupElement)
  defineXhElement('xh-checkbox-group', XhCheckboxGroupElement)
  defineXhElement('xh-toggle-group', XhToggleGroupElement)
  defineXhElement('xh-checkbox', XhCheckboxElement)
  defineXhElement('xh-switch', XhSwitchElement)
  defineXhElement('xh-slider', XhSliderElement)
  defineXhElement('xh-rating', XhRatingElement)
  defineXhElement('xh-file-upload', XhFileUploadElement)
  defineXhElement('xh-grid', XhGridElement)
  defineXhElement('xh-tabs', XhTabsElement)
  defineXhElement('xh-card', XhCardElement)
  defineXhElement('xh-accordion', XhAccordionElement)
  defineXhElement('xh-fieldset', XhFieldsetElement)
  defineXhElement('xh-separator', XhSeparatorElement)
  defineXhElement('xh-typography', XhTypographyElement)
  defineXhElement('xh-alert', XhAlertElement)
  defineXhElement('xh-image', XhImageElement)
  defineXhElement('xh-bar-code', XhBarCodeElement)
  defineXhElement('xh-matrix-code', XhMatrixCodeElement)
}
