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
    StateBlock
} from "alkatest-common/types";

export function validateReferenceBlock(block: ReferenceBlock) {
    if (typeof block !== "object" || block == null) {
        return false;
    }
    switch (block._type) {
        case "method":
            return "object" in block && "method" in block;
        case "property":
            return "object" in block && "property" in block;
        case "getObject":
            return "id" in block;
        case "ternary":
            return "condition" in block && "true" in block && "false" in block;
        default:
            return false;
    }
}

export function validateDictionaryBlock<T>(block: DictionaryBlock<T>): boolean {
    if (typeof block !== "object" || block == null) {
        return false;
    }
    if (block._type == null) {
        return (Object.values(block) as T[]).every(value => value != null);
    }
    if (typeof block._type === "string") {
        switch (block._type) {
            case "createDictionary":
                return "entries" in block;
            default:
                return validateReferenceBlock(block as ReferenceBlock);
        }
    }
    return false;
}

export function validateEntryBlock<T>(block: EntryBlock<T>): boolean {
    if (typeof block !== "object" || block == null) {
        return false;
    }
    if (block._type !== "entry") {
        return false;
    }
    return "key" in block && "value" in block;
}

export function validateArrayBlock<T>(block: ArrayBlock<T>): boolean {
    if (typeof block !== "object" || block == null) {
        return false;
    }
    if ("_type" in block) {
        switch (block._type) {
            case "filter":
                return "array" in block && "condition" in block;
            case "map":
                return "array" in block && "value" in block;
            case "keys":
                return "dictionary" in block;
            case "values":
                return "dictionary" in block;
            default:
                return validateReferenceBlock(block);
        }
    }
    return block.every(value => value != null);
}

export function validateStringBlock(block: StringBlock): boolean {
    if (typeof block === "string") {
        return true;
    }
    if (typeof block !== "object" || block == null) {
        return false;
    }
    switch (block._type) {
        case "concat":
            return "operands" in block;
        default:
            return validateReferenceBlock(block);
    }
}

export function validateNumberBlock(block: NumberBlock): boolean {
    if (typeof block === "number") {
        return true;
    }
    if (typeof block !== "object" || block == null) {
        return false;
    }
    switch (block._type) {
        case "addition":
            return "operands" in block;
        case "subtraction":
            return "operands" in block;
        case "random":
            return "min" in block && "max" in block;
        case "randomInt":
            return "min" in block && "max" in block;
        default:
            return validateReferenceBlock(block);
    }
}

export function validateBooleanBlock(block: BooleanBlock): boolean {
    if (typeof block === "boolean") {
        return true;
    }
    if (typeof block !== "object" || block == null) {
        return false;
    }
    switch (block._type) {
        case "equals":
            return "operands" in block;
        case "notEquals":
            return "operands" in block;
        case "greaterThan":
            return "operands" in block;
        case "greaterThanOrEqual":
            return "operands" in block;
        case "lessThan":
            return "operands" in block;
        case "lessThanOrEqual":
            return "operands" in block;
        case "objectExists":
            return "operands" in block;
        case "propertyExists":
            return "operands" in block && "property" in block;
        default:
            return validateReferenceBlock(block);
    }
}

export function validateActionBlock(block: ActionBlock): boolean {
    if (typeof block !== "object" || block == null) {
        return false;
    }
    switch (block._type) {
        case "branch":
            return "condition" in block;
        case "forEach":
            return "array" in block && "forEach" in block;
        case "repeat":
            return "iterations" in block && "run" in block;
        case "wait":
            return "duration" in block;
        case "addItemsToInventory":
            return "node" in block && "items" in block;
        case "setData":
            return "object" in block && "key" in block && "value" in block;
        case "addNode":
            return "nodeType" in block && "pos" in block;
        case "removeNode":
            return "node" in block;
        case "event":
            return "event" in block;
        case "error":
            return "message" in block;
        case "@return":
            return true;
        case "@break":
            return true;
        default:
            return validateReferenceBlock(block);
    }
}

export function validatePositionBlock(block: PositionBlock): boolean {
    if (typeof block !== "object" || block == null) {
        return false;
    }
    if ("type" in block) {
        return validateReferenceBlock(block);
    }
    return "x" in block && "y" in block;
}

export function validateSizeBlock(block: SizeBlock): boolean {
    if (typeof block === "number") {
        return true;
    }
    if (typeof block !== "object" || block == null) {
        return false;
    }
    if ("type" in block) {
        return validateNumberBlock(block) || validateReferenceBlock(block as ReferenceBlock);
    }
    return "width" in block && "height" in block;
}

export function validateInventoryBlock(block: Inventory): boolean {
    if (typeof block !== "object" || block == null) {
        return false;
    }
    return "slots" in block;
}

export function validateItemStackBlock(block: ItemStackBlock): boolean {
    if (typeof block !== "object" || block == null) {
        return false;
    }
    if ("item" in block && "quantity" in block) {
        return true;
    }
    return validateReferenceBlock(block);
}

export function validateNodeActionBlock(block: NodeAction): boolean {
    if (typeof block !== "object" || block == null) {
        return false;
    }
    return "display" in block && "duration" in block && "run" in block;
}

export function validateTypeBlock(block: TypeBlock): boolean {
    if (typeof block === "string") {
        return true;
    }
    if (typeof block !== "object" || block == null) {
        return false;
    }
    switch (block._type) {
        case "dictionary":
            return "keyType" in block && "valueType" in block;
        case "array":
            return "elementType" in block;
        case "object":
            return "properties" in block;
        case "number":
            return true;
        case "boolean":
            return true;
        case "string":
            return true;
        case "id":
            return "of" in block;
        case "itemStack":
            return true;
        case "action":
            return true;
        default:
            return false;
    }
}

export function validateMethodTypeBlock(block: MethodTypeBlock): boolean {
    if (typeof block !== "object" || block == null) {
        return false;
    }
    return "run" in block;
}

export function validatePropertyBlock(block: TypeBlock & { value: StateBlock }): boolean {
    if (typeof block !== "object" || block == null) {
        return false;
    }
    if (!("value" in block)) {
        return false;
    }
    if (!validateTypeBlock(block)) {
        return false;
    }
    return true;
}
