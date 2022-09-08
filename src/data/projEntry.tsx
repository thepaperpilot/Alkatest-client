import { createBoard, Shape } from "features/boards/board";
import { jsx } from "features/feature";
import type { BaseLayer, GenericLayer } from "game/layers";
import { createLayer } from "game/layers";
import { persistent } from "game/persistence";
import type { PlayerData } from "game/player";
import { render } from "util/vue";
import { computed, ref } from "vue";
import Chat from "./Chat.vue";
import { emit } from "./socket";

/**
 * @hidden
 */
export const main = createLayer("main", function (this: BaseLayer) {
    const contentPacks = persistent<(ContentPack | string)[]>(["core"]);

    const board = createBoard(() => ({
        startNodes: () => [
            {
                type: "placeholder",
                position: { x: 0, y: 0 }
            }
        ],
        types: {
            placeholder: {
                shape: Shape.Diamond,
                size: 10,
                title: "placeholder"
            }
        },
        width: "calc(100% + 20px)",
        height: "calc(100% + 100px)",
        style: "margin-top: -50px; margin-left: -10px; overflow: hidden"
    }));

    const position = ref<{ x: number; y: number }>({ x: 0, y: 0 });
    setInterval(() => {
        const pos = board.mousePosition.value;
        if (pos && (pos.x !== position.value.x || pos.y !== position.value.y)) {
            position.value = pos;
            emit("set cursor position", pos);
        }
    }, 50)

    return {
        name: "Main",
        minimizable: false,
        contentPacks,
        board,
        display: jsx(() => (
            <>
                {render(board)}
                <Chat />
            </>
        ))
    };
});

/**
 * Given a player save data object being loaded, return a list of layers that should currently be enabled.
 * If your project does not use dynamic layers, this should just return all layers.
 */
export const getInitialLayers = (
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    player: Partial<PlayerData>
): Array<GenericLayer> => [main];

/**
 * A computed ref whose value is true whenever the game is over.
 */
export const hasWon = computed(() => {
    return false;
});

/**
 * Given a player save data object being loaded with a different version, update the save data object to match the structure of the current version.
 * @param oldVersion The version of the save being loaded in
 * @param player The save data being loaded in
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export function fixOldSave(
    oldVersion: string | undefined,
    player: Partial<PlayerData>
    // eslint-disable-next-line @typescript-eslint/no-empty-function
): void {}
/* eslint-enable @typescript-eslint/no-unused-vars */
