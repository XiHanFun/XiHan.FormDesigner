/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 导出 @xihan-form/core 的公共接口。

export { createInitialValues, createRowValues, formDataFields, identifiersAt, isValueOfKind, listBindings, scopeKeys } from './bindings'
export type { DataBinding } from './bindings'
export { cloneNodesForInsert, regionScope } from './copy'
export { createDocument, createNode, createRegion, deriveKey, FORM_SETTING_PROPERTIES, isValidKey } from './create'
export type { CreateNodeOptions } from './create'
export { RUNTIME_VARIABLES } from './expression'
export { createFormModel, FORM_CORE_EXTENSION, FORM_EXTENSION_SPACES } from './extensions'
export type { FormCoreExtension, FormModel, FormRuleContext } from './extensions'
export type { FormIssue, FormIssueCode, FormIssueData, FormSchemaIssue, FormSchemaIssueCode, FormSchemaProductCode } from './issues'
export { instanceKey, resolveLinkage } from './linkage'
export type { Assignment, LinkageResult, NodeState, ResolveLinkageOptions, StateOverride } from './linkage'
export { applyOperation, applyOperations, FormOperationError } from './operations'
export type { FormOperation, FormOperationErrorCode, OperationResult, RuleList } from './operations'
export { BUILTIN_KINDS } from './registry/builtin'
export { BUILTIN_CONTAINERS, BUILTIN_STATICS, tableCells, tableSize } from './registry/builtin-containers'
export { BUILTIN_FIELDS } from './registry/builtin-fields'
export { createKindRegistry, kindLabel, LINKAGE_ACTIONS } from './registry/kinds'
export type { ContainerKindDefinition, FieldKindDefinition, KindDefinition, KindLabel, KindRegistry, StaticKindDefinition, StructureProblem, ValueKind } from './registry/kinds'
export { checkFormPropertyValue, EMPTY_PROPERTY_SCHEMA, findFormPropertyValueIssue, FORM_CONTROLS, FORM_PROPERTY_EDITORS, isValidPropertyValue, numberControl, propertyName } from './registry/properties'
export type { FormPropertyControl, FormPropertyDescriptor, FormPropertyValueIssue, PropertySchema } from './registry/properties'
export { FORM_SCHEMA_VERSION, PROPERTY_GROUPS } from './schema'
export type { AcceptedRule, ContainerNode, ExpressionRule, ExtensionData, FieldNode, FormDocument, FormNode, LengthRule, LinkageAction, LinkageRule, NodeType, PatternRule, PropertyBag, PropertyGroup, RangeRule, Region, RequiredRule, StaticNode, ValidationKind, ValidationRule } from './schema'
export { insertTableLine, mergeTableCells, removeTableLine, splitTableCell } from './table-commands'
export { collectDocumentIds, collectIds, descendantsOf, findNode, findRegion, walkNodes } from './traverse'
export type { FoundNode, FoundRegion, NodeLocation, NodeVisitor, VisitContext } from './traverse'
export { validateDocument } from './validate-document'
export type { ValidateDocumentOptions } from './validate-document'
export { validateValues } from './validate-values'
export type { ValidateValuesOptions, ValueIssue } from './validate-values'
