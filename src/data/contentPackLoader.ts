/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
    ActionBlock,
    ArrayBlock,
    ContentPack,
    CreateDictionaryBlock,
    EntryBlock,
    Inventory,
    ItemStackBlock,
    ItemType,
    MethodTypeBlock,
    NodeType,
    PositionBlock,
    SizeBlock,
    TypeBlock,
    TypeType
} from "alkatest-common/types";
import {
    Context,
    formatExceptionMessage,
    resolveBooleanBlock,
    resolveNumberBlock,
    resolveSizeBlock,
    resolveStringBlock,
    resolveToComputed,
    resolveNodeActionDictionaryBlock,
resolveInventoryBlock
} from "./contentPackResolver";
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
    validatePropertyBlock,
    validateObjectBlock
} from "./contentPackValidation";

export function isContentPack(contentPack: any): contentPack is ContentPack {
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
    objects: Context;
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
                if (id === "" || id.startsWith("@")) {
                    console.log("Trying to add item with invalid ID", curr.display, id);
                    return;
                }
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
                if (id === "" || id.startsWith("@")) {
                    console.log("Trying to add node with invalid ID", curr.display, id);
                    return;
                }
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
                if (id === "" || id.startsWith("@")) {
                    console.log("Trying to add custom type with invalid ID", curr.display, id);
                    return;
                }
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
function collectObjects(contentPacks: ContentPack[], types: Record<string, TypeType>): Context {
    const objects: Record<string, Record<string, Record<string, any>>> = {};
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
                    if (id === "" || id.startsWith("@")) {
                        console.log("Trying to add custom object with invalid ID", curr.display, id);
                        return;
                    }
                    if (typeof curr[typeId] !== "object") {
                        console.log("Custom object type not found", curr.display, typeId);
                        return;
                    }
                    const obj = (curr[typeId] as Record<string, any>)[id] as Record<string, any>;
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
                                const dict = acc[curr] as Record<string, any>;
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
                                    dict[key] = (obj[curr] as Record<string, any>)[key];
                                });
                            } else {
                                acc[curr] = obj[curr] as any;
                            }
                        }
                        return acc;
                    }, acc[id] ?? { "_base": types[typeId]});
                });
            }
            return acc;
        }, {} as Record<string, Record<string, any>>);
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
    objects: Record<string, Record<string, Record<string, any>>>,
    eventListeners: Record<string, ArrayBlock<ActionBlock>[]>
) {
    // Collapse all blocks - remove extra properties, and replace all statically resolvable blocks
    // Any improperly formatted blocks will be filtered out here
    Object.keys(items).forEach(key => {
        const item = items[key];
        try {
            if (collapseProperty(item, "display", collapseStringBlock, []) == null) {
                item.display = resolveToComputed(item, "display", resolveStringBlock);
            }
            if (collapseOptionalProperty(item, "node", collapseStringBlock, []) == null) {
                item.node = resolveToComputed(item, "node", resolveStringBlock);
            }
            if (collapseOptionalProperty(item, "maxStackSize", collapseNumberBlock, []) == null) {
                item.maxStackSize = resolveToComputed(item, "maxStackSize", resolveNumberBlock);
            }
        } catch (exception) {
            console.log(
                formatExceptionMessage(
                    `Item type '${key}' removed`,
                    exception as { message: string; stack: string[] }
                )
            );
            delete items[key];
        }
    });
    Object.keys(nodes).forEach(key => {
        const node = nodes[key];
        try {
            if (collapseProperty(node, "display", collapseStringBlock, []) == null) {
                node.display = resolveToComputed(node, "display", resolveStringBlock);
            }
            if (collapseProperty(node, "size", collapseSizeBlock, []) == null) {
                node.size = resolveToComputed(node, "size", resolveSizeBlock);
            }
            if (collapseOptionalProperty(node, "draggable", collapseBooleanBlock, []) == null) {
                node.draggable = resolveToComputed(node, "draggable", resolveBooleanBlock);
            }
            if (collapseOptionalProperty(node, "data", collapseTypeDictionaryBlock, []) == null) {
                node.data = resolveToComputed(node, "data", resolveTypeDictionaryBlock);
            }
            if (collapseOptionalProperty(node, "inventory", collapseInventoryBlock, []) == null) {
                node.inventory = resolveToComputed(node, "inventory", resolveInventoryBlock);
            }
            if (collapseOptionalProperty(node, "actions", collapseNodeActionDictionaryBlock, []) == null) {
                node.actions = resolveToComputed(node, "actions", resolveNodeActionDictionaryBlock);
            }
        } catch (exception) {
            console.log(
                formatExceptionMessage(
                    `Node type '${key}' removed`,
                    exception as { message: string; stack: string[] }
                )
            );
            delete nodes[key];
        }
    });
    Object.keys(types).forEach(key => {
        const type = types[key];
        try {
            if (collapseOptionalProperty(type, "data", collapseTypeDictionaryBlock, []) == null) {
                type.data = resolveToComputed(type, "data", resolveNodeActionDictionaryBlock);
            }
            if (collapseOptionalProperty(type, "methods", collapseMethodTypeDictionaryBlock, []) == null) {
                type.methods = resolveToComputed(type, "methods", resolveMethodTypeDictionaryBlock;
            }
            if (collapseOptionalProperty(type, "properties", collapsePropertyDictionaryBlock, []) == null) {
                type.properties = resolveToComputed(type, "properties", resolveNodeActionDictionaryBlock);
            }
        } catch (exception) {
            console.log(
                formatExceptionMessage(
                    `Object type '${key}' removed`,
                    exception as { message: string; stack: string[] }
                )
            );
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
                    try {
                        const value = collapseProperty(
                            object,
                            dataKey,
                            collapseBlockByType(data[dataKey]),
                            []
                        );
                        if (value == null) {
                            throw { message: "object could not resolve", stack: [] };
                        }
                    } catch (exception) {
                        console.log(
                            formatExceptionMessage(
                                `Object '${key}' removed due to property '${dataKey}'`,
                                exception as { message: string; stack: string[] }
                            )
                        );
                        return true;
                    }
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
            try {
                const listener = collapseOptionalProperty(
                    listeners,
                    i,
                    collapseActionArrayBlock,
                    []
                );
                if (listener == null) {
                    throw { message: "event listener could not resolve", stack: [] };
                }
            } catch (exception) {
                console.log(
                    formatExceptionMessage(
                        `Event listener #${i} for event '${eventName}' removed`,
                        exception as { message: string; stack: string[] }
                    )
                );
                console.log("Could not resolve event listener", eventName, i);
                listeners.splice(i, 1);
                i--;
            }
        }
    });
}

function collapseProperty<T, S extends keyof T, R extends T[S]>(
    obj: T,
    key: S,
    collapseFunction: (value: T[typeof key], stack: string[]) => R | null,
    stack: string[]
): R | null {
    const value = collapseFunction(obj[key], [...stack, key as string]);
    if (value != null) {
        obj[key] = value;
    }
    return value;
}

function collapseOptionalProperty<T, S extends keyof T, R extends T[S]>(
    obj: T,
    key: S,
    collapseFunction: (value: NonNullable<T[typeof key]>, stack: string[]) => R | null,
    stack: string[]
): R | null {
    if (obj[key] == null) {
        return null;
    }
    const value = collapseFunction(obj[key] as NonNullable<T[S]>, [...stack, key as string]);
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

function collapseObjectBlock(block: any, stack: string[]): (object & { _type: never }) | null {
    const errorContainer = { message: "", stack };
    if (!validateObjectBlock(block, errorContainer)) {
        throw errorContainer;
    }
    if ("_type" in block) {
        return collapseReferenceBlock(block, stack);
    }
    return block;
}

function collapseStringBlock(block: any, stack: string[]): string | null {
    const errorContainer = { message: "", stack };
    if (!validateStringBlock(block, errorContainer)) {
        throw errorContainer;
    }
    if (typeof block === "string") {
        return block;
    }
    switch (block._type) {
        case "concat": {
            const operands = collapseProperty(block, "operands", collapseStringArrayBlock, stack);
            whitelistProperties(block, "_type", "operands");
            if (operands != null && operands.every(op => typeof op === "string")) {
                return operands.join("");
            }
            return null;
        }
        default:
            return collapseReferenceBlock(block, stack);
    }
}

function collapseNumberBlock(block: any, stack: string[]): number | null {
    const errorContainer = { message: "", stack };
    if (!validateNumberBlock(block, errorContainer)) {
        throw errorContainer;
    }
    if (typeof block === "number") {
        return block;
    }
    switch (block._type) {
        case "addition": {
            const operands = collapseProperty(block, "operands", collapseNumberArrayBlock, stack);
            whitelistProperties(block, "_type", "operands");
            if (operands != null && operands.every(op => typeof op === "number")) {
                return (operands as number[]).reduce((a, b) => a + b);
            }
            return null;
        }
        case "subtraction": {
            const operands = collapseProperty(block, "operands", collapseNumberArrayBlock, stack);
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
            return collapseReferenceBlock(block, stack);
    }
}

function collapseBooleanBlock(block: any, stack: string[]): boolean | null {
    const errorContainer = { message: "", stack };
    if (!validateBooleanBlock(block, errorContainer)) {
        throw errorContainer;
    }
    if (typeof block === "boolean") {
        return block;
    }
    switch (block._type) {
        case "equals": {
            const operands = collapseProperty(block, "operands", collapseStateArrayBlock, stack);
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
            const operands = collapseProperty(block, "operands", collapseStateArrayBlock, stack);
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
            const operands = collapseProperty(block, "operands", collapseNumberArrayBlock, stack);
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
        case "greaterThanOrEqual": {
            const operands = collapseProperty(block, "operands", collapseNumberArrayBlock, stack);
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
        case "lessThan": {
            const operands = collapseProperty(block, "operands", collapseNumberArrayBlock, stack);
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
        case "lessThanOrEqual": {
            const operands = collapseProperty(block, "operands", collapseNumberArrayBlock, stack);
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
        case "contextExists": {
            collapseProperty(block, "object", collapseStringBlock, stack);
            whitelistProperties(block, "_type", "object");
            return null;
        }
        case "propertyExists": {
            const object = collapseProperty(block, "object", collapseObjectBlock, stack);
            const property = collapseProperty(block, "property", collapseStringBlock, stack);
            whitelistProperties(block, "_type", "object", "property");
            if (object != null && property != null) {
                return property in object;
            }
            return null;
        }
        case "all": {
            const operands = collapseProperty(block, "operands", collapseBooleanArrayBlock, stack);
            whitelistProperties(block, "_type", "operands");
            if (operands != null && operands.every(op => typeof op === "boolean")) {
                return operands.every(value => value);
            }
            return null;
        }
        case "any": {
            const operands = collapseProperty(block, "operands", collapseBooleanArrayBlock, stack);
            whitelistProperties(block, "_type", "operands");
            if (operands != null && operands.every(op => typeof op === "boolean")) {
                return operands.some(value => value);
            }
            return null;
        }
        case "none": {
            const operands = collapseProperty(block, "operands", collapseBooleanArrayBlock, stack);
            whitelistProperties(block, "_type", "operands");
            if (operands != null && operands.every(op => typeof op === "boolean")) {
                return !operands.every(value => value);
            }
            return null;
        }
        default:
            return collapseReferenceBlock(block, stack);
    }
}

function collapseStateBlock(block: any, stack: string[]): any | null {
    try {
        return collapseStringBlock(block, stack);
    } catch {}
    try {
        return collapseNumberBlock(block, stack);
    } catch {}
    try {
        return collapseBooleanBlock(block, stack);
    } catch {}
    try {
        return collapseStateArrayBlock(block, stack);
    } catch {}
    try {
        return collapseStateDictionaryBlock(block, stack);
    } catch {}
    try {
        return collapseObjectBlock(block, stack);
    } catch {}
    throw { message: "block could not resolve to any state", stack };
}

function collapseArrayBlock<T>(collapseFunction: (block: any, stack: string[]) => T | null) {
    return function (block: any, stack: string[]): T[] | null {
        const errorContainer = { message: "", stack };
        if (!validateArrayBlock(block, errorContainer)) {
            throw errorContainer;
        }
        if ("_type" in block) {
            switch (block._type) {
                case "filter": {
                    collapseProperty(block, "array", collapseArrayBlock(collapseFunction), stack);
                    whitelistProperties(block, "_type", "array", "condition");
                    // TODO Have a context providing @element, so if the array and filter are static const the whole block is
                    return null;
                }
                case "map": {
                    collapseProperty(block, "array", collapseStateArrayBlock, stack);
                    whitelistProperties(block, "_type", "array", "value");
                    // TODO Have a context providing @element, so if the array and filter are static const the whole block is
                    return null;
                }
                case "keys": {
                    const dictionary = collapseProperty(
                        block,
                        "dictionary",
                        collapseStateDictionaryBlock,
                        stack
                    );
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
                        collapseDictionaryBlock(collapseFunction),
                        stack
                    );
                    whitelistProperties(block, "_type", "dictionary");
                    if (dictionary != null) {
                        const values = Object.values(dictionary);
                        let allCollapsed = true;
                        for (let i = 0; i < values.length; i++) {
                            const property = collapseProperty(values, i, collapseFunction, stack);
                            if (property == null) {
                                allCollapsed = false;
                            }
                        }
                        return allCollapsed ? (values as T[]) : null;
                    }
                    return null;
                }
                default:
                    return collapseReferenceBlock(block, stack);
            }
        }
        let allCollapsed = true;
        for (let i = 0; i < block.length; i++) {
            const property = collapseProperty(block, i, collapseFunction, stack);
            if (property == null) {
                allCollapsed = false;
            }
        }
        return allCollapsed ? block : null;
    };
}
const collapseStringArrayBlock = collapseArrayBlock(collapseStringBlock);
const collapseNumberArrayBlock = collapseArrayBlock(collapseNumberBlock);
const collapseBooleanArrayBlock = collapseArrayBlock(collapseBooleanBlock);
const collapseStateArrayBlock = collapseArrayBlock(collapseStateBlock);
const collapseActionArrayBlock = collapseArrayBlock(collapseActionBlock);
const collapseItemStackArrayBlock = collapseArrayBlock(collapseItemStackBlock);

function collapseDictionaryBlock<T>(collapseFunction: (block: any, stack: string[]) => T | null) {
    return function (block: any, stack: string[]): Record<string, T> | null {
        const errorContainer = { message: "", stack };
        if (!validateDictionaryBlock(block, errorContainer)) {
            throw errorContainer;
        }
        if (!("_type" in block)) {
            Object.keys(block as Record<string, T>).forEach(key =>
                collapseProperty(block as Record<string, T>, key, collapseFunction, stack)
            );
            return block as Record<string, T>;
        }
        switch (block._type) {
            case "createDictionary": {
                const entries = collapseProperty(
                    block as CreateDictionaryBlock<T>,
                    "entries",
                    collapseArrayBlock(collapseEntryBlock(collapseFunction)),
                    stack
                );
                whitelistProperties(block as CreateDictionaryBlock<T>, "_type", "entries");
                if (
                    entries != null &&
                    entries.every(entry => validateEntryBlock(entry, errorContainer))
                ) {
                    return Object.fromEntries(entries.map(e => [e.key, e.value]));
                }
                return null;
            }
            default:
                return collapseReferenceBlock(block, stack);
        }
    };
}
const collapseStateDictionaryBlock = collapseDictionaryBlock(collapseStateBlock);
const collapseNodeActionDictionaryBlock = collapseDictionaryBlock(collapseNodeActionBlock);
const collapseItemStackDictionaryBlock = collapseDictionaryBlock(collapseItemStackBlock);
const collapseTypeDictionaryBlock = collapseDictionaryBlock(collapseTypeBlock);
const collapseMethodTypeDictionaryBlock = collapseDictionaryBlock(collapseMethodTypeBlock);
const collapsePropertyDictionaryBlock = collapseDictionaryBlock(collapsePropertyBlock);

function collapseEntryBlock<T>(collapseFunction: (block: any, stack: string[]) => T | null) {
    return function (block: any, stack: string[]): EntryBlock<T> | null {
        const errorContainer = { message: "", stack };
        if (!validateEntryBlock(block, errorContainer)) {
            throw errorContainer;
        }
        const key = collapseProperty(block, "key", collapseStringBlock, stack);
        const value = collapseProperty(block, "value", collapseFunction, stack);
        whitelistProperties(block, "key", "value");
        if (key != null && value != null) {
            return block;
        }
        return null;
    };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function collapseReferenceBlock(block: any, stack: string[]) {
    const errorContainer = { message: "", stack };
    if (!validateReferenceBlock(block, errorContainer)) {
        throw errorContainer;
    }
    switch (block._type) {
        case "method": {
            collapseProperty(block, "object", collapseObjectBlock, stack);
            collapseProperty(block, "method", collapseStringBlock, stack);
            collapseOptionalProperty(block, "params", collapseStateDictionaryBlock, stack);
            whitelistProperties(block, "_type", "object", "method", "params");
            return null;
        }
        case "property": {
            collapseProperty(block, "object", collapseObjectBlock, stack);
            collapseProperty(block, "property", collapseStringBlock, stack);
            whitelistProperties(block, "_type", "object", "property");
            return null;
        }
        case "getContext": {
            collapseProperty(block, "id", collapseStringBlock, stack);
            whitelistProperties(block, "_type", "id");
            return null;
        }
        case "ternary": {
            const condition = collapseProperty(block, "condition", collapseBooleanBlock, stack);
            const ifTrue = collapseProperty(block, "true", collapseStateBlock, stack);
            const ifFalse = collapseProperty(block, "false", collapseStateBlock, stack);
            whitelistProperties(block, "_type", "condition", "false", "true");
            if (condition != null) {
                return condition ? ifTrue : ifFalse;
            }
            return null;
        }
    }
}

function collapseActionBlock(block: any, stack: string[]) {
    const errorContainer = { message: "", stack };
    if (!validateActionBlock(block, errorContainer)) {
        throw errorContainer;
    }
    switch (block._type) {
        case "branch": {
            const condition = collapseProperty(block, "condition", collapseBooleanBlock, stack);
            const ifTrue = collapseOptionalProperty(block, "true", collapseActionArrayBlock, stack);
            const ifFalse = collapseOptionalProperty(
                block,
                "false",
                collapseActionArrayBlock,
                stack
            );
            whitelistProperties(block, "_type", "condition", "true", "false");
            if (condition != null && ifTrue === block.true && ifFalse === block.false) {
                return block;
            }
            return null;
        }
        case "forEach": {
            const array = collapseProperty(block, "array", collapseStateArrayBlock, stack);
            const forEach = collapseProperty(block, "forEach", collapseStateArrayBlock, stack);
            whitelistProperties(block, "_type", "array", "forEach");
            if (array != null && forEach != null) {
                return block;
            }
            return null;
        }
        case "repeat": {
            const iterations = collapseProperty(block, "iterations", collapseNumberBlock, stack);
            const run = collapseProperty(block, "run", collapseActionArrayBlock, stack);
            whitelistProperties(block, "_type", "iterations", "run");
            if (iterations != null && run != null) {
                return block;
            }
            return null;
        }
        case "wait": {
            const node = collapseOptionalProperty(block, "node", collapseStringBlock, stack);
            const duration = collapseProperty(block, "duration", collapseNumberBlock, stack);
            whitelistProperties(block, "_type", "node", "duration");
            if (node != null && duration != null) {
                return block;
            }
            return null;
        }
        case "addItemsToInventory": {
            const node = collapseProperty(block, "node", collapseStringBlock, stack);
            const items = collapseProperty(block, "items", collapseItemStackArrayBlock, stack);
            whitelistProperties(block, "_type", "node", "items");
            if (node != null && items != null) {
                return block;
            }
            return null;
        }
        case "setData": {
            const object = collapseProperty(block, "object", collapseObjectBlock, stack);
            const key = collapseProperty(block, "key", collapseStringBlock, stack);
            const value = collapseProperty(block, "value", collapseStateBlock, stack);
            whitelistProperties(block, "_type", "object", "key", "value");
            if (object != null && key != null && value != null) {
                return block;
            }
            return null;
        }
        case "addNode": {
            const nodeType = collapseProperty(block, "nodeType", collapseStringBlock, stack);
            const pos = collapseProperty(block, "pos", collapsePositionBlock, stack);
            const data = collapseOptionalProperty(block, "data", collapseStateBlock, stack);
            whitelistProperties(block, "_type", "nodeType", "pos", "data");
            if (nodeType != null && pos != null && data === block.data) {
                return block;
            }
            return null;
        }
        case "removeNode": {
            const node = collapseProperty(block, "node", collapseStringBlock, stack);
            whitelistProperties(block, "_type", "node");
            if (node != null) {
                return block;
            }
            return null;
        }
        case "event": {
            const event = collapseProperty(block, "event", collapseStringBlock, stack);
            const data = collapseOptionalProperty(block, "data", collapseStateBlock, stack);
            whitelistProperties(block, "_type", "event", "data");
            if (event != null && data === block.data) {
                return block;
            }
            return null;
        }
        case "error": {
            const message = collapseProperty(block, "message", collapseStringBlock, stack);
            whitelistProperties(block, "_type", "message");
            if (message != null) {
                return block;
            }
            return null;
        }
        case "@return": {
            const value = collapseOptionalProperty(block, "value", collapseStateBlock, stack);
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
            collapseReferenceBlock(block, stack);
            break;
    }
    return null;
}

function collapseInventoryBlock(block: any, stack: string[]): Inventory | null {
    const errorContainer = { message: "", stack };
    if (!validateInventoryBlock(block, errorContainer)) {
        throw errorContainer;
    }
    const slots = collapseProperty(block, "slots", collapseNumberBlock, stack);
    const canPlayerExtract = collapseOptionalProperty(
        block,
        "canPlayerExtract",
        collapseBooleanBlock,
        stack
    );
    const canPlayerInsert = collapseOptionalProperty(
        block,
        "canPlayerInsert",
        collapseBooleanBlock,
        stack
    );
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

function collapseItemStackBlock(block: any, stack: string[]): ItemStackBlock | null {
    const errorContainer = { message: "", stack };
    if (!validateItemStackBlock(block, errorContainer)) {
        throw errorContainer;
    }
    if (typeof block === "object" && "item" in block && "quantity" in block) {
        const item = collapseProperty(block, "item", collapseStringBlock, stack);
        const quantity = collapseProperty(block, "quantity", collapseNumberBlock, stack);
        whitelistProperties(block, "item", "quantity");
        if (item != null && quantity != null) {
            return block;
        }
        return null;
    } else {
        return collapseReferenceBlock(block, stack);
    }
}

function collapseNodeActionBlock(block: any, stack: string[]) {
    const errorContainer = { message: "", stack };
    if (!validateNodeActionBlock(block, errorContainer)) {
        throw errorContainer;
    }
    const cost = collapseOptionalProperty(block, "cost", collapseItemStackDictionaryBlock, stack);
    const display = collapseProperty(block, "display", collapseStringBlock, stack);
    const duration = collapseProperty(block, "duration", collapseNumberBlock, stack);
    const run = collapseProperty(block, "run", collapseActionArrayBlock, stack);
    const tooltip = collapseOptionalProperty(block, "tooltip", collapseStringBlock, stack);
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

function collapsePositionBlock(block: any, stack: string[]): PositionBlock | null {
    const errorContainer = { message: "", stack };
    if (!validatePositionBlock(block, errorContainer)) {
        throw errorContainer;
    }
    if (typeof block === "object" && "x" in block && "y" in block) {
        const x = collapseProperty(block, "x", collapseNumberBlock, stack);
        const y = collapseProperty(block, "y", collapseNumberBlock, stack);
        whitelistProperties(block, "x", "y");
        if (x != null && y != null) {
            return block;
        }
        return null;
    } else {
        return collapseReferenceBlock(block, stack);
    }
}

function collapseSizeBlock(block: any, stack: string[]): SizeBlock | null {
    const errorContainer = { message: "", stack };
    if (!validateSizeBlock(block, errorContainer)) {
        throw errorContainer;
    }
    if (validateNumberBlock(block, errorContainer)) {
        return collapseNumberBlock(block, stack);
    }
    if (typeof block === "object" && "width" in block && "height" in block) {
        const width = collapseProperty(block, "width", collapseNumberBlock, stack);
        const height = collapseProperty(block, "height", collapseNumberBlock, stack);
        whitelistProperties(block, "width", "height");
        if (width != null && height != null) {
            return block;
        }
        return null;
    } else {
        return collapseReferenceBlock(block, stack);
    }
}

function isCollapsedState(block: any): boolean {
    switch (typeof block) {
        case "boolean":
        case "number":
        case "string":
            return true;
        case "object":
            return !("_type" in block);
    }
    return false;
}

function collapseTypeBlock(block: any, stack: string[]): TypeBlock | null {
    const errorContainer = { message: "", stack };
    if (!validateTypeBlock(block, errorContainer)) {
        throw errorContainer;
    }
    if (typeof block === "string") {
        return block;
    }

    switch (block._type) {
        case "dictionary": {
            const keyType = collapseProperty(block, "keyType", collapseTypeBlock, stack);
            const valueType = collapseProperty(block, "valueType", collapseTypeBlock, stack);
            const internal = collapseOptionalProperty(
                block,
                "internal",
                collapseBooleanBlock,
                stack
            );
            whitelistProperties(block, "_type", "keyType", "valueType", "internal");
            if (keyType != null && valueType != null && block.internal === internal) {
                return block;
            }
            return null;
        }
        case "array": {
            const elementType = collapseProperty(block, "elementType", collapseTypeBlock, stack);
            const internal = collapseOptionalProperty(
                block,
                "internal",
                collapseBooleanBlock,
                stack
            );
            whitelistProperties(block, "_type", "elementType", "internal");
            if (elementType != null && block.internal === internal) {
                return block;
            }
            return null;
        }
        case "object": {
            const properties = collapseProperty(
                block,
                "properties",
                collapseTypeDictionaryBlock,
                stack
            );
            const internal = collapseOptionalProperty(
                block,
                "internal",
                collapseBooleanBlock,
                stack
            );
            whitelistProperties(block, "_type", "properties", "internal");
            if (properties != null && block.internal === internal) {
                return block;
            }
            return null;
        }
        case "number": {
            const defaultValue = collapseOptionalProperty(
                block,
                "default",
                collapseNumberBlock,
                stack
            );
            const internal = collapseOptionalProperty(
                block,
                "internal",
                collapseBooleanBlock,
                stack
            );
            whitelistProperties(block, "_type", "default", "internal");
            if (defaultValue == block.default && block.internal === internal) {
                return block;
            }
            return null;
        }
        case "boolean": {
            const defaultValue = collapseOptionalProperty(
                block,
                "default",
                collapseBooleanBlock,
                stack
            );
            const internal = collapseOptionalProperty(
                block,
                "internal",
                collapseBooleanBlock,
                stack
            );
            whitelistProperties(block, "_type", "default", "internal");
            if (defaultValue == block.default && block.internal === internal) {
                return block;
            }
            return null;
        }
        case "string": {
            const defaultValue = collapseOptionalProperty(
                block,
                "default",
                collapseStringBlock,
                stack
            );
            const internal = collapseOptionalProperty(
                block,
                "internal",
                collapseBooleanBlock,
                stack
            );
            whitelistProperties(block, "_type", "default", "internal");
            if (defaultValue == block.default && block.internal === internal) {
                return block;
            }
            return null;
        }
        case "id": {
            const of = collapseProperty(block, "of", collapseStringBlock, stack);
            const internal = collapseOptionalProperty(
                block,
                "internal",
                collapseBooleanBlock,
                stack
            );
            whitelistProperties(block, "_type", "of", "internal");
            if (of != null && block.internal === internal) {
                return block;
            }
            return null;
        }
        case "itemStack": {
            const internal = collapseOptionalProperty(
                block,
                "internal",
                collapseBooleanBlock,
                stack
            );
            whitelistProperties(block, "_type", "internal");
            if (block.internal === internal) {
                return block;
            }
            return null;
        }
        case "action": {
            const internal = collapseOptionalProperty(
                block,
                "internal",
                collapseBooleanBlock,
                stack
            );
            whitelistProperties(block, "_type", "internal");
            if (block.internal === internal) {
                return block;
            }
            return null;
        }
    }
}

function collapseMethodTypeBlock(block: any, stack: string[]): MethodTypeBlock {
    const errorContainer = { message: "", stack };
    if (!validateMethodTypeBlock(block, errorContainer)) {
        throw errorContainer;
    }
    const run = collapseProperty(block, "run", collapseActionArrayBlock, stack);
    const params = collapseOptionalProperty(block, "params", collapseStateDictionaryBlock, stack);
    const returns = collapseOptionalProperty(block, "returns", collapseTypeBlock, stack);
    whitelistProperties(block, "run", "params", "returns");
    if (run != null && block.params === params && block.returns === returns) {
        return block;
    }
    throw { message: "could not resolve method block", stack };
}

function collapsePropertyBlock(block: any, stack: string[]) {
    const errorContainer = { message: "", stack };
    if (!validatePropertyBlock(block, errorContainer)) {
        throw errorContainer;
    }
    const value = collapseStateBlock(block.value, stack);
    const any = collapseTypeBlock(block, stack);
    block.value = value;
    if (any != null) {
        return block;
    }
    return null;
}

function collapseBlockByType(type: any) {
    return function (block: any, stack: string[]): any | null {
        const errorContainer = { message: "", stack };
        if (!validateTypeBlock(block, errorContainer)) {
            throw errorContainer;
        }
        if (typeof type === "string") {
            if (typeof block === "string") {
                return block;
            }
            throw { message: "expected object ID", stack };
        }
        if (block == null) {
            if ("default" in type) {
                block = type.default;
            } else {
                throw { message: "required property not provided", stack };
            }
        }
        switch (type._type) {
            case "dictionary":
                return collapseDictionaryBlock(collapseBlockByType(type.valueType))(block, stack);
            case "array":
                return collapseArrayBlock(collapseBlockByType(type.elementType))(block, stack);
            case "object":
                const properties = collapseProperty(
                    type,
                    "properties",
                    collapseTypeDictionaryBlock,
                    stack
                );
                if (properties == null) {
                    throw { message: "could not resolve expected properties", stack };
                }
                const propertyKeys = Object.keys(properties);
                whitelistProperties(block, ...propertyKeys);
                for (let i = 0; i < propertyKeys.length; i++) {
                    const property = collapseProperty(
                        block,
                        propertyKeys[i],
                        collapseBlockByType(properties[propertyKeys[i]]),
                        stack
                    );
                    if (property == null) {
                        throw { message: `could not resolve property '${propertyKeys[i]}'`, stack };
                    }
                }
                return block;
            case "number":
                return collapseNumberBlock(block, stack);
            case "boolean":
                return collapseBooleanBlock(block, stack);
            case "string":
                return collapseStringBlock(block, stack);
            case "id":
                return collapseStringBlock(block, stack);
            case "itemStack":
                return collapseItemStackBlock(block, stack);
            case "action":
                return collapseNodeActionBlock(block, stack);
        }
    };
}
