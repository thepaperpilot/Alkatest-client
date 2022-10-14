import type {
    ActionBlock,
    ArrayBlock,
    BooleanBlock,
    ContentPack,
    CreateDictionaryBlock,
    DictionaryBlock,
    EntryBlock,
    Inventory,
    ItemStackBlock,
    ItemType,
    MethodTypeBlock,
    NodeAction,
    NodeType,
    NumberBlock,
    PositionBlock,
    ReferenceBlock,
    SizeBlock,
    StateBlock,
    StringBlock,
    TypeBlock,
    TypeType
} from "alkatest-common/types";
import type { State } from "game/persistence";
import {
    validateStringBlock,
    validateNumberBlock,
    validateBooleanBlock,
    validateArrayBlock,
    validateDictionaryBlock,
    validateEntryBlock,
    validateReferenceBlock,
    validateNodeActionBlock,
    validateActionBlock,
    validateInventoryBlock,
    validateItemStackBlock,
    validatePositionBlock,
    validateSizeBlock,
    validateTypeBlock,
    validateMethodTypeBlock,
    validatePropertyBlock
} from "./contentPackValidation";

const Invalid = Symbol("Invalid");

export function isContentPack(contentPack: State): contentPack is ContentPack {
    if (typeof contentPack !== "object") {
        console.log("Content pack is not an object");
        return false;
    }
    if (!("display" in contentPack)) {
        console.log("Content pack is missing 'display' property");
        return false;
    }

    return true;
}

export function processContentPacks(contentPacks: ContentPack[]): {
    items: Record<string, ItemType>;
    nodes: Record<string, NodeType>;
    types: Record<string, TypeType>;
    objects: Record<string, Record<string, Record<string, State>>>;
    eventListeners: Record<string, ArrayBlock<ActionBlock>[]>;
} {
    const packs = contentPacks.filter(isContentPack);

    const items = collectItems(packs);
    const nodes = collectNodes(packs);
    const types = collectTypes(packs);
    const objects = collectObjects(packs, types);
    const eventListeners = collectEventListeners(packs);

    resolveContentPacks(items, nodes, types, objects, eventListeners);

    return {
        items,
        nodes,
        types,
        objects,
        eventListeners
    };
}

// Verifies all custom items are well formed and collects them into one array
function collectItems(contentPacks: ContentPack[]): Record<string, ItemType> {
    return contentPacks.reduce((acc, curr) => {
        if ("items" in curr) {
            if (typeof curr.items !== "object") {
                console.log(
                    "Content Pack contained 'items' property that wasn't a dictionary",
                    curr.display
                );
                return acc;
            }
            Object.keys(curr.items).forEach(id => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const item = curr.items![id];
                if (id in acc) {
                    console.log("Trying to add item with duplicate ID", curr.display, id);
                    return;
                }
                if (typeof item !== "object") {
                    console.log("Item is not an object", curr.display, id);
                    return;
                }
                if (!("display" in item)) {
                    console.log("Item is missing 'display' property", curr.display, id);
                    return;
                }
                whitelistProperties(item, "display", "node", "maxStackSize");
                acc[id] = item;
            });
        }
        return acc;
    }, {} as Record<string, ItemType>);
}

// Verifies all custom nodes are well formed and collects them into one array
function collectNodes(contentPacks: ContentPack[]): Record<string, NodeType> {
    return contentPacks.reduce((acc, curr) => {
        if ("nodes" in curr) {
            if (typeof curr.nodes !== "object") {
                console.log(
                    "Content Pack contained 'nodes' property that wasn't a dictionary",
                    curr.display
                );
                return acc;
            }
            Object.keys(curr.nodes).forEach(id => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const node = curr.nodes![id];
                if (id in acc) {
                    console.log("Trying to add node with duplicate ID", curr.display, id);
                    return;
                }
                if (typeof node !== "object") {
                    console.log("Node is not an object", curr.display, id);
                    return;
                }
                const missingProperty = ["display", "size"].find(prop => !(prop in node));
                if (missingProperty) {
                    console.log(`Node is missing '${missingProperty}' property`, curr.display, id);
                    return;
                }
                whitelistProperties(
                    node,
                    "display",
                    "size",
                    "draggable",
                    "data",
                    "inventory",
                    "actions",
                    "place"
                );
                acc[id] = node;
            });
        }
        return acc;
    }, {} as Record<string, NodeType>);
}

// Verifies all custom object types are well formed and collects them into one array
function collectTypes(contentPacks: ContentPack[]): Record<string, TypeType> {
    return contentPacks.reduce((acc, curr) => {
        if ("types" in curr) {
            if (typeof curr.types !== "object") {
                console.log(
                    "Content Pack contained 'types' property that wasn't a dictionary",
                    curr.display
                );
                return acc;
            }
            Object.keys(curr.types).forEach(id => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const type = curr.types![id];
                if (id in acc) {
                    console.log("Trying to add custom type with duplicate ID", curr.display, id);
                    return;
                }
                if (typeof type !== "object") {
                    console.log("Custom type is not an object", curr.display, id);
                    return;
                }
                whitelistProperties(type, "data", "methods", "properties");
                acc[id] = type;
            });
        }
        return acc;
    }, {} as Record<string, TypeType>);
}

// Verifies all custom objects are well formed and collects them into one array
// Filters out any objects with an unknown type
function collectObjects(
    contentPacks: ContentPack[],
    types: Record<string, TypeType>
): Record<string, Record<string, Record<string, State>>> {
    const objects: Record<string, Record<string, Record<string, State>>> = {};
    Object.keys(types).forEach(typeId => {
        const data = types[typeId].data ?? {};
        const dataProperties = Object.keys(data);
        const objectsOfType = contentPacks.reduce((acc, curr) => {
            const packName = curr.display;
            if (typeId in curr) {
                if (typeof curr[typeId] !== "object") {
                    console.log(
                        `Content Pack contained '${typeId}' property that wasn't a dictionary`,
                        curr.display
                    );
                    return acc;
                }
                Object.keys(curr[typeId]).forEach(id => {
                    if (typeof curr[typeId] !== "object") {
                        console.log("Custom object type not found", curr.display, typeId);
                        return;
                    }
                    const obj = (curr[typeId] as Record<string, State>)[id] as Record<
                        string,
                        State
                    >;
                    if (typeof obj !== "object") {
                        console.log("Custom object is not an object", curr.display, typeId, id);
                        return;
                    }
                    // Strip out any properties that don't exist on the object
                    acc[id] = dataProperties.reduce((acc, curr) => {
                        const propertyType = data[curr];
                        if (curr in obj) {
                            if (curr in acc) {
                                // Attempt to merge top-level dictionaries
                                if (
                                    typeof propertyType !== "object" ||
                                    propertyType._type !== "dictionary" ||
                                    obj[curr] !== "object"
                                ) {
                                    console.log(
                                        "Custom object attempted to override property",
                                        packName,
                                        typeId,
                                        id,
                                        curr
                                    );
                                    return acc;
                                }
                                const dict = acc[curr] as Record<string, State>;
                                Object.keys(obj[curr]).forEach(key => {
                                    if (key in dict) {
                                        console.log(
                                            "Custom object attempted to override dictionary entry",
                                            packName,
                                            typeId,
                                            id,
                                            curr,
                                            key
                                        );
                                        return;
                                    }
                                    dict[key] = (obj[curr] as Record<string, State>)[key];
                                });
                            } else {
                                acc[curr] = obj[curr] as State;
                            }
                        }
                        return acc;
                    }, acc[id] ?? {});
                });
            }
            return acc;
        }, {} as Record<string, Record<string, State>>);
        if (objectsOfType) {
            objects[typeId] = objectsOfType;
        }
    });
    return objects;
}

// Verifies all starting nodes are well formed and collects them into one array
function collectEventListeners(
    contentPacks: ContentPack[]
): Record<string, ArrayBlock<ActionBlock>[]> {
    return contentPacks.reduce((acc, curr) => {
        if ("eventListeners" in curr) {
            if (typeof curr.eventListeners !== "object") {
                console.log(
                    "Content Pack contained 'eventListeners' property that wasn't an object",
                    curr.display
                );
                return acc;
            }
            Object.keys(curr.eventListeners).forEach(key => {
                if (!(key in acc)) {
                    acc[key] = [];
                }
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                acc[key].push(curr.eventListeners![key]);
            });
        }
        return acc;
    }, {} as Record<string, ArrayBlock<ActionBlock>[]>);
}

// Goes through all properties and validates them, and resolves any that are static
function resolveContentPacks(
    items: Record<string, ItemType>,
    nodes: Record<string, NodeType>,
    types: Record<string, TypeType>,
    objects: Record<string, Record<string, Record<string, State>>>,
    eventListeners: Record<string, ArrayBlock<ActionBlock>[]>
) {
    // Collapse all blocks - remove extra properties, and replace all statically resolvable blocks
    // Any improperly formatted blocks will be filtered out here
    Object.keys(items).forEach(key => {
        const item = items[key];
        if (
            collapseProperty(item, "display", collapseStringBlock) === Invalid ||
            collapseOptionalProperty(item, "node", collapseStringBlock) === Invalid ||
            collapseOptionalProperty(item, "maxStackSize", collapseNumberBlock) === Invalid
        ) {
            console.log(`Item type '${key}' removed due to invalid property`);
            delete items[key];
        }
    });
    Object.keys(nodes).forEach(key => {
        const node = nodes[key];
        if (
            collapseProperty(node, "display", collapseStringBlock) === Invalid ||
            collapseProperty(node, "size", collapseSizeBlock) === Invalid ||
            collapseOptionalProperty(node, "draggable", collapseBooleanBlock) === Invalid ||
            collapseOptionalProperty(node, "data", collapseTypeDictionaryBlock) === Invalid ||
            collapseOptionalProperty(node, "inventory", collapseInventoryBlock) === Invalid ||
            collapseOptionalProperty(node, "actions", collapseNodeActionDictionaryBlock) === Invalid
        ) {
            console.log(`Node type '${key}' removed due to invalid property`);
            delete nodes[key];
        }
    });
    Object.keys(types).forEach(key => {
        const type = types[key];
        if (
            collapseOptionalProperty(type, "data", collapseTypeDictionaryBlock) === Invalid ||
            collapseOptionalProperty(type, "methods", collapseMethodTypeDictionaryBlock) ===
                Invalid ||
            collapseOptionalProperty(type, "properties", collapsePropertyDictionaryBlock) ===
                Invalid
        ) {
            console.log(`Object type '${key}' removed due to invalid property`);
            delete types[key];
        }
    });
    Object.keys(objects).forEach(type => {
        if (!(type in types)) {
            console.log(`Could not determine type of custom object '${type}'`);
            delete objects[type];
        }
        Object.keys(objects[type]).forEach(key => {
            const object = objects[type][key];
            const data = types[type].data;
            if (data) {
                const isInvalid = Object.keys(data).some(dataKey => {
                    const value = collapseProperty(
                        object,
                        dataKey,
                        collapseBlockByType(data[dataKey])
                    );
                    if (value === Invalid || value == null) {
                        console.log(`Object ${key} removed due to invalid data`, dataKey);
                        return true;
                    }
                    return false;
                });
                if (isInvalid) {
                    delete objects[key];
                } else {
                    whitelistProperties(object, ...Object.keys(data));
                }
            } else {
                whitelistProperties(object);
            }
        });
    });
    Object.keys(eventListeners).forEach(eventName => {
        const listeners = eventListeners[eventName];
        for (let i = 0; i < listeners.length; i++) {
            const listener = collapseOptionalProperty(listeners, i, collapseActionArrayBlock);
            if (listener === Invalid || listener == null) {
                console.log("Could not resolve event listener", eventName, i);
                listeners.splice(i, 1);
                i--;
                continue;
            }
        }
    });
}

function collapseProperty<T, S extends keyof T, R extends T[S]>(
    obj: T,
    key: S,
    collapseFunction: (value: T[typeof key]) => R | null | typeof Invalid
): R | null | typeof Invalid {
    const value = collapseFunction(obj[key]);
    if (value === Invalid) {
        return Invalid;
    }
    if (value != null) {
        obj[key] = value;
    }
    return value;
}

function collapseOptionalProperty<T, S extends keyof T, R extends T[S]>(
    obj: T,
    key: S,
    collapseFunction: (value: NonNullable<T[typeof key]>) => R | null | typeof Invalid
): R | null | typeof Invalid {
    if (obj[key] == null) {
        return null;
    }
    const value = collapseFunction(obj[key] as NonNullable<T[S]>);
    if (value === Invalid) {
        return Invalid;
    }
    if (value != null) {
        obj[key] = value;
    }
    return value;
}

function whitelistProperties<T extends object>(obj: T, ...whitelist: (keyof T)[]) {
    Object.keys(obj).forEach(
        key => whitelist.includes(key as keyof T) || delete obj[key as keyof T]
    );
}

function collapseStringBlock(block: StringBlock): string | null | typeof Invalid {
    if (!validateStringBlock(block)) {
        return Invalid;
    }
    if (typeof block === "string") {
        return block;
    }
    switch (block._type) {
        case "concat": {
            const operands = collapseProperty(block, "operands", collapseStringArrayBlock);
            if (operands === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "operands");
            if (operands != null && operands.every(op => typeof op === "string")) {
                return operands.join("");
            }
            return null;
        }
        default:
            return collapseReferenceBlock(block);
    }
}

function collapseNumberBlock(block: NumberBlock): number | null | typeof Invalid {
    if (!validateNumberBlock(block)) {
        return Invalid;
    }
    if (typeof block === "number") {
        return block;
    }
    switch (block._type) {
        case "addition": {
            const operands = collapseProperty(block, "operands", collapseNumberArrayBlock);
            if (operands === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "operands");
            if (operands != null && operands.every(op => typeof op === "number")) {
                return (operands as number[]).reduce((a, b) => a + b);
            }
            return null;
        }
        case "subtraction": {
            const operands = collapseProperty(block, "operands", collapseNumberArrayBlock);
            if (operands === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "operands");
            if (operands != null && operands.every(op => typeof op === "number")) {
                return (operands as number[]).reduce((a, b) => a - b);
            }
            return null;
        }
        case "random":
            return null;
        case "randomInt":
            return null;
        default:
            return collapseReferenceBlock(block);
    }
}

function collapseBooleanBlock(block: BooleanBlock): boolean | null | typeof Invalid {
    if (!validateBooleanBlock(block)) {
        return null;
    }
    if (typeof block === "boolean") {
        return block;
    }
    switch (block._type) {
        case "equals": {
            const operands = collapseProperty(block, "operands", collapseBooleanArrayBlock);
            if (operands === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "operands");
            if (operands != null && operands.every(op => isCollapsedState(op))) {
                for (let i = 1; i < operands.length; i++) {
                    if (operands[i] != operands[i - 1]) {
                        return false;
                    }
                }
                return true;
            }
            return null;
        }
        case "notEquals": {
            const operands = collapseProperty(block, "operands", collapseBooleanArrayBlock);
            if (operands === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "operands");
            if (operands != null && operands.every(op => isCollapsedState(op))) {
                for (let i = 1; i < operands.length; i++) {
                    for (let j = i - 1; j >= 0; j++) {
                        if (operands[i] == operands[j]) {
                            return false;
                        }
                    }
                }
                return true;
            }
            return null;
        }
        case "greaterThan": {
            const operands = collapseProperty(block, "operands", collapseNumberArrayBlock);
            if (operands === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "operands");
            if (operands != null && operands.every(op => typeof op === "number")) {
                for (let i = 1; i < operands.length; i++) {
                    if (operands[i] > operands[i - 1]) {
                        return false;
                    }
                }
                return true;
            }
            return null;
        }
        case "greaterThanOrEqual": {
            const operands = collapseProperty(block, "operands", collapseNumberArrayBlock);
            if (operands === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "operands");
            if (operands != null && operands.every(op => typeof op === "number")) {
                for (let i = 1; i < operands.length; i++) {
                    if (operands[i] >= operands[i - 1]) {
                        return false;
                    }
                }
                return true;
            }
            return null;
        }
        case "lessThan": {
            const operands = collapseProperty(block, "operands", collapseNumberArrayBlock);
            if (operands === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "operands");
            if (operands != null && operands.every(op => typeof op === "number")) {
                for (let i = 1; i < operands.length; i++) {
                    if (operands[i] < operands[i - 1]) {
                        return false;
                    }
                }
                return true;
            }
            return null;
        }
        case "lessThanOrEqual": {
            const operands = collapseProperty(block, "operands", collapseNumberArrayBlock);
            if (operands === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "operands");
            if (operands != null && operands.every(op => typeof op === "number")) {
                for (let i = 1; i < operands.length; i++) {
                    if (operands[i] <= operands[i - 1]) {
                        return false;
                    }
                }
                return true;
            }
            return null;
        }
        case "objectExists": {
            const object = collapseProperty(block, "object", collapseStringBlock);
            if (object === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "object");
            return null;
        }
        case "propertyExists": {
            const object = collapseProperty(block, "object", collapseStringBlock);
            const property = collapseProperty(block, "property", collapseStringBlock);
            if (object === Invalid || property === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "object", "property");
            return null;
        }
        default:
            return collapseReferenceBlock(block);
    }
}

function collapseStateBlock(block: StateBlock): State | null | typeof Invalid {
    let state: State | null | typeof Invalid = collapseStringBlock(block);
    if (state != Invalid) {
        return state;
    }
    state = collapseNumberBlock(block);
    if (state != Invalid) {
        return state;
    }
    state = collapseBooleanBlock(block);
    if (state != Invalid) {
        return state;
    }
    state = collapseStateArrayBlock(block);
    if (state != Invalid) {
        return state;
    }
    state = collapseStateDictionaryBlock(block);
    return state;
}

function collapseArrayBlock<T, S extends T>(
    collapseFunction: (block: T) => S | null | typeof Invalid
) {
    return function (block: ArrayBlock<T>): (T | S)[] | null | typeof Invalid {
        if (!validateArrayBlock(block)) {
            return null;
        }
        if ("_type" in block) {
            switch (block._type) {
                case "filter": {
                    const array = collapseProperty(
                        block,
                        "array",
                        collapseArrayBlock(collapseFunction)
                    );
                    if (array === Invalid) {
                        return Invalid;
                    }
                    whitelistProperties(block, "_type", "array", "condition");
                    // TODO Have a context providing @element, so if the array and filter are static const the whole block is
                    return null;
                }
                case "map": {
                    const array = collapseProperty(block, "array", collapseStateArrayBlock);
                    if (array === Invalid) {
                        return Invalid;
                    }
                    whitelistProperties(block, "_type", "array", "value");
                    // TODO Have a context providing @element, so if the array and filter are static const the whole block is
                    // Should also validate the returned value is correctly typed
                    return null;
                }
                case "keys": {
                    const dictionary = collapseProperty(
                        block,
                        "dictionary",
                        collapseStateDictionaryBlock
                    );
                    if (dictionary === Invalid) {
                        return Invalid;
                    }
                    whitelistProperties(block, "_type", "dictionary");
                    if (dictionary != null) {
                        return Object.keys(dictionary) as T[];
                    }
                    return null;
                }
                case "values": {
                    const dictionary = collapseProperty(
                        block,
                        "dictionary",
                        collapseDictionaryBlock(collapseFunction)
                    );
                    if (dictionary === Invalid) {
                        return Invalid;
                    }
                    whitelistProperties(block, "_type", "dictionary");
                    if (dictionary != null) {
                        const values = Object.values(dictionary);
                        for (let i = 0; i < values.length; i++) {
                            const property = collapseProperty(values, i, collapseFunction);
                            if (property === Invalid) {
                                return Invalid;
                            }
                        }
                        return values;
                    }
                    return null;
                }
                default:
                    return collapseReferenceBlock(block);
            }
        }
        for (let i = 0; i < block.length; i++) {
            const property = collapseProperty(block, i, collapseFunction);
            if (property === Invalid) {
                return Invalid;
            }
        }
        return block;
    };
}
const collapseStringArrayBlock = collapseArrayBlock(collapseStringBlock);
const collapseNumberArrayBlock = collapseArrayBlock(collapseNumberBlock);
const collapseBooleanArrayBlock = collapseArrayBlock(collapseBooleanBlock);
const collapseStateArrayBlock = collapseArrayBlock(collapseStateBlock);
const collapseActionArrayBlock = collapseArrayBlock(collapseActionBlock);
const collapseItemStackArrayBlock = collapseArrayBlock(collapseItemStackBlock);

function collapseDictionaryBlock<T, S extends T>(
    collapseFunction: (block: T) => S | null | typeof Invalid
) {
    return function (block: DictionaryBlock<T>): Record<string, T | S> | null | typeof Invalid {
        if (!validateDictionaryBlock(block)) {
            return Invalid;
        }
        if (block._type == null) {
            Object.keys(block).forEach(key =>
                collapseProperty(block as Record<string, T>, key, collapseFunction)
            );
            if (Object.values(block).some(v => v === Invalid)) {
                return Invalid;
            }
            return block as Record<string, T>;
        }
        switch (block._type) {
            case "createDictionary": {
                const entries = collapseProperty(
                    block as CreateDictionaryBlock<T>,
                    "entries",
                    collapseArrayBlock(collapseEntryBlock(collapseFunction))
                );
                if (entries === Invalid) {
                    return Invalid;
                }
                whitelistProperties(block as CreateDictionaryBlock<T>, "_type", "entries");
                if (entries != null && entries.every(validateEntryBlock)) {
                    return Object.fromEntries(entries.map(e => [e.key, e.value]));
                }
                return null;
            }
            default:
                return collapseReferenceBlock(block as ReferenceBlock);
        }
    };
}
const collapseStateDictionaryBlock = collapseDictionaryBlock(collapseStateBlock);
const collapseNodeActionDictionaryBlock = collapseDictionaryBlock(collapseNodeActionBlock);
const collapseItemStackDictionaryBlock = collapseDictionaryBlock(collapseItemStackBlock);
const collapseTypeDictionaryBlock = collapseDictionaryBlock(collapseTypeBlock);
const collapseMethodTypeDictionaryBlock = collapseDictionaryBlock(collapseMethodTypeBlock);
const collapsePropertyDictionaryBlock = collapseDictionaryBlock(collapsePropertyBlock);

function collapseEntryBlock<T, S extends T>(
    collapseFunction: (block: T) => S | null | typeof Invalid
) {
    return function (block: EntryBlock<T>): EntryBlock<T> | null | typeof Invalid {
        if (!validateEntryBlock(block)) {
            return Invalid;
        }
        const key = collapseProperty(block, "key", collapseStringBlock);
        const value = collapseProperty(block, "value", collapseFunction);
        if (key === Invalid || value === Invalid) {
            return Invalid;
        }
        whitelistProperties(block, "_type", "key", "value");
        if (key != null && value != null) {
            return block;
        }
        return null;
    };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function collapseReferenceBlock(block: ReferenceBlock) {
    if (!validateReferenceBlock(block)) {
        return Invalid;
    }
    switch (block._type) {
        case "method": {
            const object = collapseProperty(block, "object", collapseStringBlock);
            const method = collapseProperty(block, "method", collapseStringBlock);
            const params = collapseOptionalProperty(block, "params", collapseStateDictionaryBlock);
            if (object === Invalid || method === Invalid || params === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "object", "method", "params");
            return null;
        }
        case "property": {
            const object = collapseProperty(block, "object", collapseStringBlock);
            const property = collapseProperty(block, "property", collapseStringBlock);
            if (object === Invalid || property === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "object", "property");
            return null;
        }
        case "getObject": {
            const id = collapseProperty(block, "id", collapseStringBlock);
            if (id === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "id");
            return null;
        }
        case "ternary": {
            const condition = collapseProperty(block, "condition", collapseBooleanBlock);
            const ifTrue = collapseProperty(block, "true", collapseStateBlock);
            const ifFalse = collapseProperty(block, "false", collapseStateBlock);
            if (condition === Invalid || ifTrue === Invalid || ifFalse === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "condition", "false", "true");
            if (condition != null && ifTrue != null && ifFalse != null) {
                // TODO validation for collapsing ternaries?
                // Ternary blocks should theoretically never be static const though
                // return condition ? ifTrue : ifFalse;
            }
            return null;
        }
    }
    return Invalid;
}

function collapseNodeActionBlock(block: NodeAction) {
    if (!validateNodeActionBlock(block)) {
        return Invalid;
    }
    const cost = collapseOptionalProperty(block, "cost", collapseItemStackDictionaryBlock);
    const display = collapseProperty(block, "display", collapseStringBlock);
    const duration = collapseProperty(block, "duration", collapseNumberBlock);
    const run = collapseProperty(block, "run", collapseActionArrayBlock);
    const tooltip = collapseOptionalProperty(block, "tooltip", collapseStringBlock);
    if (
        cost === Invalid ||
        display === Invalid ||
        duration === Invalid ||
        run === Invalid ||
        tooltip === Invalid
    ) {
        return Invalid;
    }
    whitelistProperties(block, "cost", "display", "duration", "run", "tooltip");
    if (
        display != null &&
        duration != null &&
        run != null &&
        cost === block.cost &&
        tooltip === block.tooltip
    ) {
        return block;
    }
    return null;
}

function collapseActionBlock(block: ActionBlock) {
    if (!validateActionBlock(block)) {
        return Invalid;
    }
    switch (block._type) {
        case "branch": {
            const condition = collapseProperty(block, "condition", collapseBooleanBlock);
            const ifTrue = collapseOptionalProperty(block, "true", collapseActionArrayBlock);
            const ifFalse = collapseOptionalProperty(block, "false", collapseActionArrayBlock);
            if (condition === Invalid || ifTrue === Invalid || ifFalse === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "condition", "true", "false");
            if (condition != null && ifTrue === block.true && ifFalse === block.false) {
                return block;
            }
            return null;
        }
        case "forEach": {
            const array = collapseProperty(block, "array", collapseStateArrayBlock);
            const forEach = collapseProperty(block, "forEach", collapseStateArrayBlock);
            if (array === Invalid || forEach === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "array", "forEach");
            if (array != null && forEach != null) {
                return block;
            }
            return null;
        }
        case "repeat": {
            const iterations = collapseProperty(block, "iterations", collapseNumberBlock);
            const run = collapseProperty(block, "run", collapseActionArrayBlock);
            if (iterations === Invalid || run === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "iterations", "run");
            if (iterations != null && run != null) {
                return block;
            }
            return null;
        }
        case "wait": {
            const node = collapseOptionalProperty(block, "node", collapseStringBlock);
            const duration = collapseProperty(block, "duration", collapseNumberBlock);
            if (node === Invalid || duration === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "node", "duration");
            if (node != null && duration != null) {
                return block;
            }
            return null;
        }
        case "addItemsToInventory": {
            const node = collapseProperty(block, "node", collapseStringBlock);
            const items = collapseProperty(block, "items", collapseItemStackArrayBlock);
            if (node === Invalid || items === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "node", "items");
            if (node != null && items != null) {
                return block;
            }
            return null;
        }
        case "setData": {
            const object = collapseProperty(block, "object", collapseStringBlock);
            const key = collapseProperty(block, "key", collapseStringBlock);
            const value = collapseProperty(block, "value", collapseStateBlock);
            if (object === Invalid || key === Invalid || value === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "object", "key", "value");
            if (object != null && key != null && value != null) {
                return block;
            }
            return null;
        }
        case "addNode": {
            const nodeType = collapseProperty(block, "nodeType", collapseStringBlock);
            const pos = collapseProperty(block, "pos", collapsePositionBlock);
            const data = collapseOptionalProperty(block, "data", collapseStateBlock);
            if (nodeType === Invalid || pos === Invalid || data === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "nodeType", "pos", "data");
            if (nodeType != null && pos != null && data === block.data) {
                return block;
            }
            return null;
        }
        case "removeNode": {
            const node = collapseProperty(block, "node", collapseStringBlock);
            if (node === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "node");
            if (node != null) {
                return block;
            }
            return null;
        }
        case "event": {
            const event = collapseProperty(block, "event", collapseStringBlock);
            const data = collapseOptionalProperty(block, "data", collapseStateBlock);
            if (event === Invalid || data === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "event", "data");
            if (event != null && data === block.data) {
                return block;
            }
            return null;
        }
        case "error": {
            const message = collapseProperty(block, "message", collapseStringBlock);
            if (message === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "message");
            if (message != null) {
                return block;
            }
            return null;
        }
        case "@return": {
            const value = collapseOptionalProperty(block, "value", collapseStateBlock);
            if (value === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "value");
            if (value === block.value) {
                return block;
            }
            return null;
        }
        case "@break":
            whitelistProperties(block, "_type");
            break;
        default:
            collapseReferenceBlock(block);
            break;
    }
    return null;
}

function collapseInventoryBlock(block: Inventory): Inventory | null | typeof Invalid {
    if (!validateInventoryBlock(block)) {
        return Invalid;
    }
    const slots = collapseProperty(block, "slots", collapseNumberBlock);
    const canPlayerExtract = collapseOptionalProperty(
        block,
        "canPlayerExtract",
        collapseBooleanBlock
    );
    const canPlayerInsert = collapseOptionalProperty(
        block,
        "canPlayerInsert",
        collapseBooleanBlock
    );
    if (slots === Invalid || canPlayerExtract === Invalid || canPlayerInsert === Invalid) {
        return Invalid;
    }
    whitelistProperties(block, "slots", "canPlayerExtract", "canPlayerInsert");
    if (
        slots != null &&
        canPlayerExtract === block.canPlayerExtract &&
        canPlayerInsert === block.canPlayerInsert
    ) {
        return block;
    }
    return null;
}

function collapseItemStackBlock(block: ItemStackBlock): ItemStackBlock | null | typeof Invalid {
    if (!validateItemStackBlock(block)) {
        return Invalid;
    }
    if (typeof block === "object" && "item" in block && "quantity" in block) {
        const item = collapseProperty(block, "item", collapseStringBlock);
        const quantity = collapseProperty(block, "quantity", collapseNumberBlock);
        if (item === Invalid || quantity === Invalid) {
            return Invalid;
        }
        whitelistProperties(block, "item", "quantity");
        if (item != null && quantity != null) {
            return block;
        }
        return null;
    } else {
        return collapseReferenceBlock(block);
    }
}

function collapsePositionBlock(block: PositionBlock): PositionBlock | null | typeof Invalid {
    if (!validatePositionBlock(block)) {
        return Invalid;
    }
    if (typeof block === "object" && "x" in block && "y" in block) {
        const x = collapseProperty(block, "x", collapseNumberBlock);
        const y = collapseProperty(block, "y", collapseNumberBlock);
        if (x === Invalid || y === Invalid) {
            return Invalid;
        }
        whitelistProperties(block, "x", "y");
        if (x != null && y != null) {
            return block;
        }
        return null;
    } else {
        return collapseReferenceBlock(block);
    }
}

function collapseSizeBlock(block: SizeBlock): SizeBlock | null | typeof Invalid {
    if (!validateSizeBlock(block)) {
        return Invalid;
    }
    if (validateNumberBlock(block as NumberBlock)) {
        return collapseNumberBlock(block as NumberBlock);
    }
    if (typeof block === "object" && "width" in block && "height" in block) {
        const width = collapseProperty(block, "width", collapseNumberBlock);
        const height = collapseProperty(block, "height", collapseNumberBlock);
        if (width === Invalid || height === Invalid) {
            return Invalid;
        }
        whitelistProperties(block, "width", "height");
        if (width != null && height != null) {
            return block;
        }
        return null;
    } else {
        return collapseReferenceBlock(block as ReferenceBlock);
    }
}

function isCollapsedState(block: StateBlock): boolean {
    switch (typeof block) {
        case "boolean":
        case "number":
        case "string":
            return true;
        case "object":
            if ("_type" in block) {
                return false;
            }
            break;
    }
    return false;
}

function collapseTypeBlock(block: TypeBlock): TypeBlock | null | typeof Invalid {
    if (!validateTypeBlock(block)) {
        return Invalid;
    }
    if (typeof block === "string") {
        return block;
    }

    switch (block._type) {
        case "dictionary": {
            const keyType = collapseProperty(block, "keyType", collapseTypeBlock);
            const valueType = collapseProperty(block, "valueType", collapseTypeBlock);
            const internal = collapseOptionalProperty(block, "internal", collapseBooleanBlock);
            if (keyType === Invalid || valueType === Invalid || internal === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "keyType", "valueType", "internal");
            if (keyType != null && valueType != null && block.internal === internal) {
                return block;
            }
            return null;
        }
        case "array": {
            const elementType = collapseProperty(block, "elementType", collapseTypeBlock);
            const internal = collapseOptionalProperty(block, "internal", collapseBooleanBlock);
            if (elementType === Invalid || internal === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "elementType", "internal");
            if (elementType != null && block.internal === internal) {
                return block;
            }
            return null;
        }
        case "object": {
            const properties = collapseProperty(block, "properties", collapseTypeDictionaryBlock);
            const internal = collapseOptionalProperty(block, "internal", collapseBooleanBlock);
            if (properties === Invalid || internal === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "properties", "internal");
            if (properties != null && block.internal === internal) {
                return block;
            }
            return null;
        }
        case "number": {
            const defaultValue = collapseOptionalProperty(block, "default", collapseNumberBlock);
            const internal = collapseOptionalProperty(block, "internal", collapseBooleanBlock);
            if (defaultValue === Invalid || internal === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "default", "internal");
            if (defaultValue == block.default && block.internal === internal) {
                return block;
            }
            return null;
        }
        case "boolean": {
            const defaultValue = collapseOptionalProperty(block, "default", collapseBooleanBlock);
            const internal = collapseOptionalProperty(block, "internal", collapseBooleanBlock);
            if (defaultValue === Invalid || internal === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "default", "internal");
            if (defaultValue == block.default && block.internal === internal) {
                return block;
            }
            return null;
        }
        case "string": {
            const defaultValue = collapseOptionalProperty(block, "default", collapseStringBlock);
            const internal = collapseOptionalProperty(block, "internal", collapseBooleanBlock);
            if (defaultValue === Invalid || internal === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "default", "internal");
            if (defaultValue == block.default && block.internal === internal) {
                return block;
            }
            return null;
        }
        case "id": {
            const of = collapseProperty(block, "of", collapseStringBlock);
            const internal = collapseOptionalProperty(block, "internal", collapseBooleanBlock);
            if (of === Invalid || internal === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "of", "internal");
            if (of != null && block.internal === internal) {
                return block;
            }
            return null;
        }
        case "itemStack": {
            const internal = collapseOptionalProperty(block, "internal", collapseBooleanBlock);
            if (internal === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "internal");
            if (block.internal === internal) {
                return block;
            }
            return null;
        }
        case "action": {
            const internal = collapseOptionalProperty(block, "internal", collapseBooleanBlock);
            if (internal === Invalid) {
                return Invalid;
            }
            whitelistProperties(block, "_type", "internal");
            if (block.internal === internal) {
                return block;
            }
            return null;
        }
    }
    return Invalid;
}

function collapseMethodTypeBlock(block: MethodTypeBlock) {
    if (!validateMethodTypeBlock(block)) {
        return Invalid;
    }
    const run = collapseProperty(block, "run", collapseActionArrayBlock);
    const params = collapseOptionalProperty(block, "params", collapseStateDictionaryBlock);
    const returns = collapseOptionalProperty(block, "returns", collapseTypeBlock);
    if (run === Invalid || params === Invalid || returns === Invalid) {
        return Invalid;
    }
    whitelistProperties(block, "run", "params", "returns");
    if (run != null && block.params === params && block.returns === returns) {
        return block;
    }
    return Invalid;
}

function collapsePropertyBlock(block: TypeBlock & { value: StateBlock }) {
    if (!validatePropertyBlock(block)) {
        return Invalid;
    }
    const value = collapseStateBlock(block.value);
    const state = collapseTypeBlock(block);
    if (value === Invalid || value == null || state === Invalid) {
        return Invalid;
    }
    block.value = value;
    if (state != null) {
        return block;
    }
    return null;
}

function collapseBlockByType(type: TypeBlock) {
    return function (block: StateBlock): StateBlock | null | typeof Invalid {
        if (!validateTypeBlock(type)) {
            return Invalid;
        }
        if (typeof type === "string") {
            return typeof block === "string" ? block : Invalid;
        }
        if (block == null) {
            if ("default" in type) {
                block = type.default;
            } else {
                return Invalid;
            }
        }
        switch (type._type) {
            case "dictionary":
                return collapseDictionaryBlock(collapseBlockByType(type.valueType))(block);
            case "array":
                return collapseArrayBlock(collapseBlockByType(type.elementType))(block);
            case "object":
                const properties = collapseProperty(
                    type,
                    "properties",
                    collapseTypeDictionaryBlock
                );
                if (properties === Invalid || properties == null) {
                    return Invalid;
                }
                const propertyKeys = Object.keys(properties);
                whitelistProperties(block, ...propertyKeys);
                for (let i = 0; i < propertyKeys.length; i++) {
                    const property = collapseProperty(
                        block,
                        propertyKeys[i],
                        collapseBlockByType(properties[propertyKeys[i]])
                    );
                    if (property === Invalid || property == null) {
                        return Invalid;
                    }
                }
                return block;
            case "number":
                return collapseNumberBlock(block);
            case "boolean":
                return collapseBooleanBlock(block);
            case "string":
                return collapseStringBlock(block);
            case "id":
                return collapseStringBlock(block);
            case "itemStack":
                return collapseItemStackBlock(block);
            case "action":
                return collapseNodeActionBlock(block);
        }
        return Invalid;
    };
}
