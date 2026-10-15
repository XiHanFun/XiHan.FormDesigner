/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 导出 @xihan-form/core 的公共接口。

export { createInitialValues, createRowValues, identifiersAt, isValueOfKind, listBindings, scopeKeys } from './bindings'
export type { DataBinding } from './bindings'
export { createDocument, createNode, createRegion, deriveKey, FORM_SETTING_PROPERTIES, isValidKey } from './create'
export type { CreateNodeOptions } from './create'
export { RUNTIME_VARIABLES } from './expression'
export { createSequentialIds } from './ids'
export type { IdSource } from './ids'
export type { FormIssue, FormIssueCode, FormIssueData } from './issues'
export { instanceKey, resolveLinkage } from './linkage'
export type { Assignment, LinkageResult, NodeState, ResolveLinkageOptions, StateOverride } from './linkage'
export { applyOperation, applyOperations, FormOperationError } from './operations'
export type { FormOperation, FormOperationErrorCode, OperationResult, RuleList } from './operations'
export { BUILTIN_KINDS, createBuiltinKindRegistry } from './registry/builtin'
export { BUILTIN_CONTAINERS, BUILTIN_STATICS, tableCells, tableSize } from './registry/builtin-containers'
export { BUILTIN_FIELDS } from './registry/builtin-fields'
export { createEditorRegistry, DEFAULT_EDITORS } from './registry/editors'
export type { EditorRegistry, EditorRegistryOptions } from './registry/editors'
export { createKindRegistry, LINKAGE_ACTIONS } from './registry/kinds'
export type { ContainerKindDefinition, FieldKindDefinition, KindDefinition, KindRegistry, StaticKindDefinition, StructureProblem, ValueKind } from './registry/kinds'
export { defaultProperties, EMPTY_PROPERTY_SCHEMA, isValidPropertyValue } from './registry/properties'
export type { PropertyDescriptor, PropertySchema, PropertyType } from './registry/properties'
export { FORM_SCHEMA_VERSION, PROPERTY_GROUPS } from './schema'
export type { AcceptedRule, ContainerNode, ExpressionRule, FieldNode, FormDocument, FormNode, LengthRule, LinkageAction, LinkageRule, NodeType, PatternRule, PropertyBag, PropertyGroup, RangeRule, Region, RequiredRule, StaticNode, ValidationKind, ValidationRule } from './schema'
export { insertTableLine, mergeTableCells, removeTableLine, splitTableCell } from './table-commands'
export { descendantsOf, findNode, findRegion, walkNodes } from './traverse'
export type { FoundNode, FoundRegion, NodeLocation, NodeVisitor, VisitContext } from './traverse'
export { validateDocument } from './validate-document'
export type { ValidateDocumentOptions } from './validate-document'
export { validateValues } from './validate-values'
export type { ValidateValuesOptions, ValueIssue } from './validate-values'
