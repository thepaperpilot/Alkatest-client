/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
    ReferenceBlock,
    DictionaryBlock,
    EntryBlock,
    ArrayBlock,
    StringBlock,
    NumberBlock,
    BooleanBlock,
    ActionBlock,
    PositionBlock,
    SizeBlock,
    Inventory,
    ItemStackBlock,
    NodeAction,
    TypeBlock,
    MethodTypeBlock,
    ObjectBlock
} from "alkatest-common/types";

export function validateBlock(
    block: any,
    errorContainer: { message: string },
    skipTypeCheck = false
): block is Record<string, unknown> {
    if (block == null) {
        errorContainer.message = "block is null";
        return false;
    }
    if (typeof block !== "object") {
        errorContainer.message = "block is not object";
        return false;
    }
    if (skipTypeCheck) {
        return true;
    }
    if (!("_type" in block)) {
        errorContainer.message = "block is missing '_type' property";
        return false;
    }
    if (typeof block._type !== "string") {
        errorContainer.message = `block has non-string '_type' property`;
        return false;
    }
    return true;
}

export function validateProperties<T extends string>(
    block: object,
    errorContainer: { message: string },
    ...properties: T[]
): block is {
    [x in T]: x extends T ? unknown : never;
} {
    for (const prop in properties) {
        if (!(prop in block)) {
            errorContainer.message = `block is missing '${prop}' property`;
            return false;
        }
    }
    return true;
}

export function validateReferenceBlock(
    block: any,
    errorContainer: { message: string }
): block is ReferenceBlock {
    if (!validateBlock(block, errorContainer)) {
        return false;
    }
    switch (block._type) {
        case "method":
            return validateProperties(block, errorContainer, "object", "method");
        case "property":
            return validateProperties(block, errorContainer, "object", "property");
        case "getContext":
            return validateProperties(block, errorContainer, "id");
        case "ternary":
            return validateProperties(block, errorContainer, "condition", "true", "false");
        default:
            errorContainer.message = `block has unknown type '${block._type}'`;
            return false;
    }
}

export function validateDictionaryBlock(
    block: any,
    errorContainer: { message: string }
): block is DictionaryBlock | ReferenceBlock {
    if (!validateBlock(block, errorContainer, true)) {
        return false;
    }
    if (block._type == null) {
        const nullKey = Object.keys(block).find(key => block[key] == null);
        if (nullKey == null) {
            return true;
        }
        errorContainer.message = `dictionary block has null value for key '${nullKey}`;
        return false;
    }
    if (typeof block._type === "string") {
        switch (block._type) {
            case "createDictionary":
                return validateProperties(block, errorContainer, "entries");
            default:
                return validateReferenceBlock(block, errorContainer);
        }
    }
    return false;
}

export function validateEntryBlock(
    block: any,
    errorContainer: { message: string }
): block is EntryBlock {
    if (!validateBlock(block, errorContainer, true)) {
        return false;
    }
    return validateProperties(block, errorContainer, "key", "value");
}

export function validateArrayBlock(
    block: any,
    errorContainer: { message: string }
): block is ArrayBlock | ReferenceBlock {
    if (Array.isArray(block)) {
        const nullIndex = block.findIndex(value => value == null);
        if (nullIndex == -1) {
            return true;
        }
        errorContainer.message = `array block has null value for index '${nullIndex}`;
        return false;
    }
    if (!validateBlock(block, errorContainer)) {
        return false;
    }
    switch (block._type) {
        case "filter":
            return validateProperties(block, errorContainer, "array", "condition");
        case "map":
            return validateProperties(block, errorContainer, "array", "value");
        case "keys":
            return validateProperties(block, errorContainer, "dictionary");
        case "values":
            return validateProperties(block, errorContainer, "dictionary");
        default:
            return validateReferenceBlock(block, errorContainer);
    }
}

export function validateObjectBlock(
    block: any,
    errorContainer: { message: string }
): block is ObjectBlock {
    if (!validateBlock(block, errorContainer, true)) {
        return false;
    }
    if ("_type" in block) {
        return validateReferenceBlock(block, errorContainer);
    }
    return true;
}

export function validateStringBlock(
    block: any,
    errorContainer: { message: string }
): block is StringBlock | ReferenceBlock {
    if (typeof block === "string") {
        return true;
    }
    if (!validateBlock(block, errorContainer)) {
        return false;
    }
    switch (block._type) {
        case "concat":
            return validateProperties(block, errorContainer, "operands");
        default:
            return validateReferenceBlock(block, errorContainer);
    }
}

export function validateNumberBlock(
    block: any,
    errorContainer: { message: string }
): block is NumberBlock | ReferenceBlock {
    if (typeof block === "number") {
        return true;
    }
    if (!validateBlock(block, errorContainer)) {
        return false;
    }
    switch (block._type) {
        case "addition":
            return validateProperties(block, errorContainer, "operands");
        case "subtraction":
            return validateProperties(block, errorContainer, "operands");
        case "random":
            return validateProperties(block, errorContainer, "min", "max");
        case "randomInt":
            return validateProperties(block, errorContainer, "min", "max");
        default:
            return validateReferenceBlock(block, errorContainer);
    }
}

export function validateBooleanBlock(
    block: any,
    errorContainer: { message: string }
): block is BooleanBlock | ReferenceBlock {
    if (typeof block === "boolean") {
        return true;
    }
    if (!validateBlock(block, errorContainer)) {
        return false;
    }
    switch (block._type) {
        case "equals":
            return validateProperties(block, errorContainer, "operands");
        case "notEquals":
            return validateProperties(block, errorContainer, "operands");
        case "greaterThan":
            return validateProperties(block, errorContainer, "operands");
        case "greaterThanOrEqual":
            return validateProperties(block, errorContainer, "operands");
        case "lessThan":
            return validateProperties(block, errorContainer, "operands");
        case "lessThanOrEqual":
            return validateProperties(block, errorContainer, "operands");
        case "contextExists":
            return validateProperties(block, errorContainer, "object");
        case "propertyExists":
            return validateProperties(block, errorContainer, "object", "property");
        case "all":
            return validateProperties(block, errorContainer, "operands");
        case "any":
            return validateProperties(block, errorContainer, "operands");
        case "none":
            return validateProperties(block, errorContainer, "operands");
        default:
            return validateReferenceBlock(block, errorContainer);
    }
}

export function validateActionBlock(
    block: any,
    errorContainer: { message: string }
): block is ActionBlock | ReferenceBlock {
    if (!validateBlock(block, errorContainer)) {
        return false;
    }
    switch (block._type) {
        case "branch":
            return validateProperties(block, errorContainer, "condition");
        case "forEach":
            return validateProperties(block, errorContainer, "array", "forEach");
        case "repeat":
            return validateProperties(block, errorContainer, "iterations", "run");
        case "wait":
            return validateProperties(block, errorContainer, "duration");
        case "addItemsToInventory":
            return validateProperties(block, errorContainer, "node", "items");
        case "setData":
            return validateProperties(block, errorContainer, "object", "key", "value");
        case "addNode":
            return validateProperties(block, errorContainer, "nodeType", "pos");
        case "removeNode":
            return validateProperties(block, errorContainer, "node");
        case "event":
            return validateProperties(block, errorContainer, "event");
        case "error":
            return validateProperties(block, errorContainer, "message");
        case "@return":
            return true;
        case "@break":
            return true;
        default:
            return validateReferenceBlock(block, errorContainer);
    }
}

export function validatePositionBlock(
    block: any,
    errorContainer: { message: string }
): block is PositionBlock | ReferenceBlock {
    if (!validateBlock(block, errorContainer, true)) {
        return false;
    }
    if ("_type" in block) {
        return validateReferenceBlock(block, errorContainer);
    }
    return validateProperties(block, errorContainer, "x", "y");
}

export function validateSizeBlock(
    block: any,
    errorContainer: { message: string }
): block is SizeBlock | ReferenceBlock {
    if (typeof block === "number") {
        return true;
    }
    if (!validateBlock(block, errorContainer, true)) {
        return false;
    }
    if ("_type" in block) {
        return (
            validateNumberBlock(block, errorContainer) ||
            validateReferenceBlock(block, errorContainer)
        );
    }
    return validateProperties(block, errorContainer, "width", "height");
}

export function validateInventoryBlock(
    block: any,
    errorContainer: { message: string }
): block is Inventory {
    if (!validateBlock(block, errorContainer, true)) {
        return false;
    }
    return validateProperties(block, errorContainer, "slots");
}

export function validateItemStackBlock(
    block: any,
    errorContainer: { message: string }
): block is ItemStackBlock | ReferenceBlock {
    if (!validateBlock(block, errorContainer, true)) {
        return false;
    }
    if ("_type" in block) {
        return validateReferenceBlock(block, errorContainer);
    }
    return validateProperties(block, errorContainer, "item", "quantity");
}

export function validateNodeActionBlock(
    block: any,
    errorContainer: { message: string }
): block is NodeAction {
    if (!validateBlock(block, errorContainer, true)) {
        return false;
    }
    return validateProperties(block, errorContainer, "display", "duration", "run");
}

export function validateTypeBlock(
    block: any,
    errorContainer: { message: string }
): block is TypeBlock {
    if (typeof block === "string") {
        return true;
    }
    if (!validateBlock(block, errorContainer)) {
        return false;
    }
    switch (block._type) {
        case "dictionary":
            return validateProperties(block, errorContainer, "keyType", "valueType");
        case "array":
            return validateProperties(block, errorContainer, "elementType");
        case "object":
            return validateProperties(block, errorContainer, "properties");
        case "number":
            return true;
        case "boolean":
            return true;
        case "string":
            return true;
        case "id":
            return validateProperties(block, errorContainer, "of");
        case "itemStack":
            return true;
        case "action":
            return true;
        default:
            errorContainer.message = `block has unknown type '${block._type}'`;
            return false;
    }
}

export function validateMethodTypeBlock(
    block: any,
    errorContainer: { message: string }
): block is MethodTypeBlock {
    if (!validateBlock(block, errorContainer)) {
        return false;
    }
    return validateProperties(block, errorContainer, "run");
}

export function validatePropertyBlock(
    block: any,
    errorContainer: { message: string }
): block is TypeBlock & { value: any } {
    if (!validateBlock(block, errorContainer, true)) {
        return false;
    }
    if (!validateProperties(block, errorContainer, "value")) {
        return false;
    }
    if (!validateTypeBlock(block, errorContainer)) {
        return false;
    }
    return true;
}
