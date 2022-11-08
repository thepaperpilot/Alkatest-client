/* eslint-disable @typescript-eslint/no-explicit-any */
import { computed, ComputedRef } from "@vue/reactivity";
import { isObject } from "@vue/shared";
import type { ActionBlock, ArrayBlock, CreateDictionaryBlock } from "alkatest-common/types";
import { getUniqueNodeID } from "features/boards/board";
import {
    validateActionBlock,
    validateArrayBlock,
    validateBooleanBlock,
    validateDictionaryBlock,
    validateEntryBlock,
    validateItemStackBlock,
    validateInventoryBlock,
    validateNodeActionBlock,
    validateNumberBlock,
    validatePositionBlock,
    validateSizeBlock,
    validateStringBlock,
    validateObjectBlock,
    validateReferenceBlock
} from "./contentPackValidation";
import { main } from "./projEntry";

export type Context = Record<string, Record<string, any>>;

export const BreakAction = Symbol("Break");
export const ReturnAction = Symbol("Return");

export function resolveEvent(event: string, data: any) {
    let context = main.customObjects.value;
    let contextPrefix = "@";
    let i = 1;
    while (`${contextPrefix}data` in context) {
        contextPrefix = `${++i}@`;
    }
    context = { ...context, [`${contextPrefix}iteration`]: data };
    main.events.value[event].forEach((actions, i) => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            resolveActionArrayBlock(actions, context, []);
        } catch (exception) {
            console.error(
                formatExceptionMessage(
                    `Failed to run event '${event}' listener #${i}`,
                    exception as { message: string; stack: string[] }
                )
            );
        }
    });
}

export function formatExceptionMessage(
    resolution: string,
    { stack, message }: { stack: string[]; message: string }
) {
    return `${resolution}\n${stack.join(".")}: ${message}`;
}

export function resolveToComputed<T extends object, S extends keyof T, R = T[S]>(
    block: T,
    property: S,
    resolveFunction: (block: any, context: Context, stack: string[]) => R
): ComputedRef<R | null> {
    return computed(() => {
        try {
            return resolveFunction(block[property], main.customObjects.value, [property as string]);
        } catch (exception) {
            console.error(
                formatExceptionMessage(
                    `Failed to resolve '${property as string}' computed property`,
                    exception as { message: string; stack: string[] }
                )
            );
            return null;
        }
    });
}

export function resolveStringBlock(block: any, context: Context, stack: string[]): string {
    const errorContainer = { message: "", stack };
    if (!validateStringBlock(block, errorContainer)) {
        throw errorContainer;
    }
    if (typeof block === "string") {
        return block;
    }
    switch (block._type) {
        case "concat": {
            const operands = resolveStringArrayBlock(block.operands, context, [
                ...stack,
                "operands"
            ]);
            return operands.join("");
        }
        default:
            return resolveReferenceBlock(block, resolveStringBlock, context, stack);
    }
}

export function resolveNumberBlock(block: any, context: Context, stack: string[]): number {
    const errorContainer = { message: "", stack };
    if (!validateNumberBlock(block, errorContainer)) {
        throw errorContainer;
    }
    if (typeof block === "number") {
        return block;
    }
    switch (block._type) {
        case "addition": {
            const operands = resolveNumberArrayBlock(block.operands, context, [
                ...stack,
                "operands"
            ]);
            return operands.reduce((a, b) => a - b);
        }
        case "subtraction": {
            const operands = resolveNumberArrayBlock(block.operands, context, [
                ...stack,
                "operands"
            ]);
            return operands.reduce((a, b) => a + b);
        }
        case "random": {
            const max = resolveNumberBlock(block.max, context, [...stack, "max"]);
            const min = resolveNumberBlock(block.min, context, [...stack, "min"]);
            return Math.random() * (max - min) + min;
        }
        case "randomInt": {
            const max = resolveNumberBlock(block.max, context, [...stack, "max"]);
            const min = resolveNumberBlock(block.min, context, [...stack, "min"]);
            return Math.floor(Math.random() * (max - min) + min);
        }
        default:
            return resolveReferenceBlock(block, resolveNumberBlock, context, stack);
    }
}

export function resolveBooleanBlock(block: any, context: Context, stack: string[]): boolean {
    const errorContainer = { message: "", stack };
    if (!validateBooleanBlock(block, errorContainer)) {
        throw errorContainer;
    }
    if (typeof block === "boolean") {
        return block;
    }
    switch (block._type) {
        case "equals": {
            const operands = resolveStateArrayBlock(block.operands, context, [
                ...stack,
                "operands"
            ]);
            for (let i = 1; i < operands.length; i++) {
                if (operands[i] != operands[i - 1]) {
                    return false;
                }
            }
            return true;
        }
        case "notEquals": {
            const operands = resolveStateArrayBlock(block.operands, context, [
                ...stack,
                "operands"
            ]);
            for (let i = 1; i < operands.length; i++) {
                if (operands[i] == operands[i - 1]) {
                    return false;
                }
            }
            return true;
        }
        case "greaterThan": {
            const operands = resolveNumberArrayBlock(block.operands, context, [
                ...stack,
                "operands"
            ]);
            for (let i = 1; i < operands.length; i++) {
                if (operands[i] <= operands[i - 1]) {
                    return false;
                }
            }
            return true;
        }
        case "greaterThanOrEqual": {
            const operands = resolveNumberArrayBlock(block.operands, context, [
                ...stack,
                "operands"
            ]);
            for (let i = 1; i < operands.length; i++) {
                if (operands[i] < operands[i - 1]) {
                    return false;
                }
            }
            return true;
        }
        case "lessThan": {
            const operands = resolveNumberArrayBlock(block.operands, context, [
                ...stack,
                "operands"
            ]);
            for (let i = 1; i < operands.length; i++) {
                if (operands[i] >= operands[i - 1]) {
                    return false;
                }
            }
            return true;
        }
        case "lessThanOrEqual": {
            const operands = resolveNumberArrayBlock(block.operands, context, [
                ...stack,
                "operands"
            ]);
            for (let i = 1; i < operands.length; i++) {
                if (operands[i] > operands[i - 1]) {
                    return false;
                }
            }
            return true;
        }
        case "contextExists": {
            const object = resolveStringBlock(block.object, context, [...stack, "object"]);
            return object in context;
        }
        case "propertyExists": {
            const object = resolveObjectBlock(block.object, context, [...stack, "object"]);
            const property = resolveStringBlock(block.property, context, [...stack, "property"]);
            return property in object;
        }
        case "all": {
            const operands = resolveBooleanArrayBlock(block.operands, context, [
                ...stack,
                "operands"
            ]);
            return operands.every(value => value);
        }
        case "any": {
            const operands = resolveBooleanArrayBlock(block.operands, context, [
                ...stack,
                "operands"
            ]);
            return operands.some(value => value);
        }
        case "none": {
            const operands = resolveBooleanArrayBlock(block.operands, context, [
                ...stack,
                "operands"
            ]);
            return !operands.every(value => value);
        }
        default:
            return resolveReferenceBlock(block, resolveBooleanBlock, context, stack);
    }
}

export function resolveObjectBlock(
    block: any,
    context: Context,
    stack: string[]
): Record<string, unknown> & { _type: never } {
    const errorContainer = { message: "", stack };
    if (!validateObjectBlock(block, errorContainer)) {
        throw errorContainer;
    }
    if ("_type" in block) {
        return resolveReferenceBlock(block, resolveObjectBlock, context, stack);
    }
    return block;
}

export function resolveStateBlock(block: any, context: Context, stack: string[]): any {
    try {
        return resolveStringBlock(block, context, stack);
    } catch {}
    try {
        return resolveNumberBlock(block, context, stack);
    } catch {}
    try {
        return resolveBooleanBlock(block, context, stack);
    } catch {}
    try {
        return resolveStateArrayBlock(block, context, stack);
    } catch {}
    try {
        return resolveStateDictionaryBlock(block, context, stack);
    } catch {}
    try {
        return resolveObjectBlock(block, context, stack);
    } catch {}
    throw { message: "block could not resolve to any state", stack };
}

export function resolveReferenceBlock<T>(
    block: any,
    resolveFunction: (block: any, context: Context, stack: string[]) => T,
    context: Context,
    stack: string[]
): T {
    const errorContainer = { message: "", stack };
    if (!validateReferenceBlock(block, errorContainer)) {
        throw errorContainer;
    }
    switch (block._type) {
        case "method": {
            const object = resolveObjectBlock(block.object, context, [
                ...stack,
                "object"
            ]) as Record<string, unknown>;
            const method = resolveStringBlock(block.method, context, [...stack, "method"]);
            const params = resolveStateDictionaryBlock(block.params, context, [...stack, "params"]);
            let run;
            if (
                "_base" in object &&
                isObject(object["_base"]) &&
                "methods" in object["_base"] &&
                isObject(object["_base"].methods) &&
                method in object["_base"].methods
            ) {
                run = object["_base"].methods[method].run;
            } else if (method in object) {
                run = object[method];
            } else {
                errorContainer.message = "Could not run method that does not exist";
                throw errorContainer;
            }
            return resolveFunction(run, { ...context, ...params }, stack);
        }
        case "property": {
            const object = resolveObjectBlock(block.object, context, [...stack, "object"]);
            const property = resolveStringBlock(block.property, context, [...stack, "property"]);
            let prop;
            if (
                "_base" in object &&
                isObject(object["_base"]) &&
                "properties" in object["_base"] &&
                isObject(object["_base"].properties) &&
                property in object["_base"].properties
            ) {
                prop = object["_base"].properties[property].run;
            } else if (property in object) {
                prop = object[property];
            } else {
                errorContainer.message = `Could not get property ${property} that does not exist`;
                throw errorContainer;
            }
            return resolveFunction(prop, context, stack);
        }
        case "getContext": {
            const id = resolveStringBlock(block.id, context, [...stack, "id"]);
            if (!(id in context)) {
                errorContainer.message = `Could not get item ${id} from context that does not exist`;
                throw errorContainer;
            }
            return resolveFunction(context[id], context, stack);
        }
        case "ternary": {
            const condition = resolveBooleanBlock(block.condition, context, [
                ...stack,
                "condition"
            ]);
            const prop = condition ? "true" : "false";
            return resolveStateBlock(block[prop], context, [...stack, prop]);
        }
    }
}

export function resolveEntryBlock<T>(
    resolveFunction: (block: any, context: Context, stack: string[]) => T
) {
    return function (block: any, context: Context, stack: string[]): { key: string; value: T } {
        const errorContainer = { message: "", stack };
        if (!validateEntryBlock(block, errorContainer)) {
            throw errorContainer;
        }
        const key = resolveStringBlock(block.key, context, [...stack, "key"]);
        const value = resolveFunction(block.value, context, [...stack, "value"]);
        return { key, value };
    };
}

export function resolveActionBlock(block: any, context: Context, stack: string[]): any {
    const errorContainer = { message: "", stack };
    if (!validateActionBlock(block, errorContainer)) {
        throw errorContainer;
    }
    switch (block._type) {
        case "branch": {
            const condition = resolveBooleanBlock(block.condition, context, [
                ...stack,
                "condition"
            ]);
            if (condition) {
                if (block.true) {
                    resolveActionArrayBlock(block.true, context, [...stack, "true"]);
                }
            } else if (block.false) {
                resolveActionArrayBlock(block.false, context, [...stack, "false"]);
            }
            break;
        }
        case "forEach": {
            const array = resolveStateArrayBlock(block.array, context, [...stack, "array"]);
            let contextPrefix = "@";
            let i = 1;
            while (`${contextPrefix}index` in context || `${contextPrefix}element` in context) {
                contextPrefix = `${++i}@`;
            }
            array.forEach((value, index) => {
                resolveActionArrayBlock(
                    block.forEach,
                    {
                        ...context,
                        [`${contextPrefix}index`]: index,
                        [`${contextPrefix}element`]: value
                    },
                    [...stack, index.toString()]
                );
            });
            break;
        }
        case "repeat": {
            const iterations = resolveNumberBlock(block.iterations, context, [
                ...stack,
                "iterations"
            ]);
            let contextPrefix = "@";
            let i = 1;
            while (`${contextPrefix}iteration` in context) {
                contextPrefix = `${++i}@`;
            }
            for (let i = 0; i < iterations; i++) {
                resolveActionArrayBlock(
                    block.run,
                    {
                        ...context,
                        [`${contextPrefix}iteration`]: i
                    },
                    [...stack, "run"]
                );
            }
            break;
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
            const object = resolveObjectBlock(block.object, context, [...stack, "object"]);
            const key = resolveStringBlock(block.key, context, [...stack, "key"]);
            const value = resolveStateBlock(block.value, context, [...stack, "value"]);
            object[key] = value;
            break;
        }
        case "addNode": {
            const nodeType = resolveStringBlock(block.nodeType, context, [...stack, "nodeType"]);
            const pos = resolvePositionBlock(block.pos, context, [...stack, "pos"]);
            const data = resolveStateBlock(block.data, context, [...stack, "data"]);
            const nodes = main.board.state.value.nodes;
            nodes.push({
                id: getUniqueNodeID(main.board),
                position: pos,
                type: nodeType,
                state: data
            });
            break;
        }
        case "removeNode": {
            const id = resolveNumberBlock(block.node, context, [...stack, "node"]);
            const nodes = main.board.state.value.nodes;
            const nodeIndex = nodes.findIndex(node => node.id === id);
            if (nodeIndex >= 0) {
                nodes.splice(nodeIndex, 1);
            } else {
                throw { message: `could not remove nonexistent node ${id}`, stack };
            }
            break;
        }
        case "event": {
            const event = resolveStringBlock(block.event, context, [...stack, "event"]);
            const data = resolveStateBlock(block.data, context, [...stack, "data"]);
            resolveEvent(event, data);
            break;
        }
        case "error": {
            const message = resolveStringBlock(block.message, context, [...stack, "message"]);
            console.error(message);
            break;
        }
        case "@return": {
            const value = resolveStateBlock(block.value, context, [...stack, "value"]);
            return value;
        }
        case "@break":
            return BreakAction;
    }
}

export function resolveArrayBlock<T>(
    resolveFunction: (block: any, context: Context, stack: string[]) => T
) {
    return function (block: any, context: Context, stack: string[]): T[] {
        const errorContainer = { message: "", stack };
        if (!validateArrayBlock(block, errorContainer)) {
            throw errorContainer;
        }
        if ("_type" in block) {
            switch (block._type) {
                case "filter": {
                    let array = resolveStateArrayBlock(block.array, context, [...stack, "array"]);
                    let contextPrefix = "@";
                    let i = 1;
                    while (
                        `${contextPrefix}index` in context ||
                        `${contextPrefix}element` in context
                    ) {
                        contextPrefix = `${++i}@`;
                    }
                    array = array.map((value, index) => {
                        return resolveFunction(
                            block,
                            {
                                ...context,
                                [`${contextPrefix}index`]: index,
                                [`${contextPrefix}element`]: value
                            },
                            [...stack, index.toString()]
                        );
                    });
                    for (let i = array.length - 1; i >= 0; i--) {
                        const condition = resolveBooleanBlock(
                            block.condition,
                            {
                                ...context,
                                [`${contextPrefix}index`]: i,
                                [`${contextPrefix}element`]: array[i]
                            },
                            [...stack, i.toString()]
                        );
                        if (condition === false) {
                            array.splice(i, 1);
                        }
                    }
                    return array;
                }
                case "map": {
                    let array = resolveStateArrayBlock(block.array, context, [...stack, "array"]);
                    let contextPrefix = "@";
                    let i = 1;
                    while (
                        `${contextPrefix}index` in context ||
                        `${contextPrefix}element` in context
                    ) {
                        contextPrefix = `${++i}@`;
                    }
                    array = array.map((value, index) => {
                        return resolveStateBlock(
                            block.value,
                            {
                                ...context,
                                [`${contextPrefix}index`]: index,
                                [`${contextPrefix}element`]: value
                            },
                            [...stack, index.toString()]
                        );
                    });
                    array = array.map((value, index) => {
                        return resolveFunction(
                            block.value,
                            {
                                ...context,
                                [`${contextPrefix}index`]: index,
                                [`${contextPrefix}element`]: value
                            },
                            [...stack, index.toString()]
                        );
                    });
                    return array;
                }
                case "keys": {
                    const dictionary = resolveStateDictionaryBlock(block.dictionary, context, [
                        ...stack,
                        "dictionary"
                    ]);
                    let contextPrefix = "@";
                    let i = 1;
                    while (
                        `${contextPrefix}index` in context ||
                        `${contextPrefix}element` in context
                    ) {
                        contextPrefix = `${++i}@`;
                    }
                    const keys = Object.keys(dictionary).map((value, index) => {
                        return resolveFunction(
                            value,
                            {
                                ...context,
                                [`${contextPrefix}index`]: index,
                                [`${contextPrefix}element`]: value as any
                            },
                            [...stack, index.toString()]
                        );
                    });
                    return keys as T[];
                }
                case "values": {
                    const dictionary = resolveStateDictionaryBlock(block.dictionary, context, [
                        ...stack,
                        "dictionary"
                    ]);
                    let contextPrefix = "@";
                    let i = 1;
                    while (
                        `${contextPrefix}index` in context ||
                        `${contextPrefix}element` in context
                    ) {
                        contextPrefix = `${++i}@`;
                    }
                    const values = Object.values(dictionary).map((value, index) => {
                        return resolveFunction(
                            value,
                            {
                                ...context,
                                [`${contextPrefix}index`]: index,
                                [`${contextPrefix}element`]: value
                            },
                            [...stack, index.toString()]
                        );
                    });
                    return values as T[];
                }
                default:
                    return resolveReferenceBlock(
                        block,
                        resolveArrayBlock(resolveFunction),
                        context,
                        stack
                    );
            }
        }
        let contextPrefix = "@";
        let i = 1;
        while (`${contextPrefix}index` in context || `${contextPrefix}element` in context) {
            contextPrefix = `${++i}@`;
        }
        const arr = block.map((value, index) => {
            return resolveFunction(
                value,
                {
                    ...context,
                    [`${contextPrefix}index`]: index,
                    [`${contextPrefix}element`]: value
                },
                [...stack, index.toString()]
            );
        });
        return arr as T[];
    };
}
export const resolveStringArrayBlock = resolveArrayBlock(resolveStringBlock);
export const resolveNumberArrayBlock = resolveArrayBlock(resolveNumberBlock);
export const resolveBooleanArrayBlock = resolveArrayBlock(resolveBooleanBlock);
export const resolveStateArrayBlock = resolveArrayBlock(resolveStateBlock);
export const resolveActionArrayBlock = resolveArrayBlock(resolveActionBlock);

export function resolveDictionaryBlock<T>(
    resolveFunction: (block: any, context: Context, stack: string[]) => T
) {
    return function (block: any, context: Context, stack: string[]): Record<string, T> {
        const errorContainer = { message: "", stack };
        if (!validateDictionaryBlock(block, errorContainer)) {
            throw errorContainer;
        }
        if (!("_type" in block)) {
            const newBlock = { ...block };
            Object.keys(newBlock).forEach(key => {
                newBlock[key] = resolveFunction(newBlock[key], context, [...stack, key]);
            });
            return newBlock;
        }
        switch (block._type) {
            case "createDictionary": {
                const entries = resolveArrayBlock(resolveEntryBlock(resolveFunction))(
                    (block as CreateDictionaryBlock<T>).entries,
                    context,
                    [...stack, "entries"]
                );
                return Object.fromEntries(entries.map(e => [e.key, e.value]));
            }
            default:
                return resolveReferenceBlock(
                    block,
                    resolveDictionaryBlock(resolveFunction),
                    context,
                    stack
                );
        }
    };
}
export const resolveStringDictionaryBlock = resolveDictionaryBlock(resolveStringBlock);
export const resolveNumberDictionaryBlock = resolveDictionaryBlock(resolveNumberBlock);
export const resolveBooleanDictionaryBlock = resolveDictionaryBlock(resolveBooleanBlock);
export const resolveStateDictionaryBlock = resolveDictionaryBlock(resolveStateBlock);
export const resolveItemStackDictionaryBlock = resolveDictionaryBlock(resolveItemStackBlock);
export const resolveNodeActionDictionaryBlock = resolveDictionaryBlock(resolveNodeActionBlock);

export function resolveInventoryBlock(
    block: any,
    context: Context,
    stack: string[]
): { slots: number; canPlayerExtract: boolean; canPlayerInsert: boolean } {
    const errorContainer = { message: "", stack };
    if (!validateInventoryBlock(block, errorContainer)) {
        throw errorContainer;
    }
    const slots = resolveNumberBlock(block.slots, context, [...stack, "slots"]);
    const canPlayerExtract = resolveBooleanBlock(block.canPlayerExtract, context, [
        ...stack,
        "canPlayerExtract"
    ]);
    const canPlayerInsert = resolveBooleanBlock(block.canPlayerInsert, context, [
        ...stack,
        "canPlayerInsert"
    ]);
    return { slots, canPlayerExtract, canPlayerInsert };
}

export function resolveItemStackBlock(
    block: any,
    context: Context,
    stack: string[]
): { item: string; quantity: number } {
    const errorContainer = { message: "", stack };
    if (!validateItemStackBlock(block, errorContainer)) {
        throw errorContainer;
    }
    if (typeof block === "object" && "item" in block && "quantity" in block) {
        const item = resolveStringBlock(block.item, context, [...stack, "item"]);
        const quantity = resolveNumberBlock(block.quantity, context, [...stack, "quantity"]);
        return { item, quantity };
    } else {
        return resolveReferenceBlock(block, resolveItemStackBlock, context, stack);
    }
}

export function resolveNodeActionBlock(
    block: any,
    context: Context,
    stack: string[]
): {
    display: string;
    duration: number;
    tooltip: string;
    cost: Record<string, { item: string; quantity: number }>;
    run: ArrayBlock<ActionBlock>;
} {
    const errorContainer = { message: "", stack };
    if (!validateNodeActionBlock(block, errorContainer)) {
        throw errorContainer;
    }
    const cost = resolveItemStackDictionaryBlock(block.cost, context, [...stack, "cost"]);
    const display = resolveStringBlock(block.display, context, [...stack, "display"]);
    const duration = resolveNumberBlock(block.duration, context, [...stack, "duration"]);
    const tooltip = resolveStringBlock(block.tooltip, context, [...stack, "tooltip"]);
    return { cost, display, duration, tooltip, run: block.run };
}

export function resolvePositionBlock(
    block: any,
    context: Context,
    stack: string[]
): { x: number; y: number } {
    const errorContainer = { message: "", stack };
    if (!validatePositionBlock(block, errorContainer)) {
        throw errorContainer;
    }
    if (typeof block === "object" && "x" in block && "y" in block) {
        const x = resolveNumberBlock(block.x, context, [...stack, "x"]);
        const y = resolveNumberBlock(block.y, context, [...stack, "y"]);
        return { x, y };
    } else {
        return resolveReferenceBlock(block, resolvePositionBlock, context, stack);
    }
}

export function resolveSizeBlock(
    block: any,
    context: Context,
    stack: string[]
): { width: number; height: number } {
    const errorContainer = { message: "", stack };
    if (!validateSizeBlock(block, errorContainer)) {
        throw errorContainer;
    }
    if (validateNumberBlock(block, errorContainer)) {
        const size = resolveNumberBlock(block, context, stack);
        return { width: size, height: size };
    } else if (typeof block === "object" && "width" in block && "height" in block) {
        const width = resolveNumberBlock(block.width, context, [...stack, "width"]);
        const height = resolveNumberBlock(block.height, context, [...stack, "height"]);
        return { width, height };
    } else {
        errorContainer.message =
            "Could not resolve size block because it wasn't a number nor size object";
        throw errorContainer;
    }
}
