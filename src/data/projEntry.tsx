import { jsx } from "features/feature";
import type { BaseLayer, GenericLayer } from "game/layers";
import { createLayer } from "game/layers";
import type { PlayerData } from "game/player";
import { computed } from "vue";
import Chat from "./Chat.vue";
import HexGrid from "./HexGrid.vue";
import { persistent } from "game/persistence";
import "./main.css";

const tiles = {
    gray: "rgba(64, 64, 64, 0.6)",
    red: "rgba(255, 0, 0, 0.86)",
    green: "rgba(0, 255, 0, 0.6)",
    blue: "rgba(0, 0, 255, 0.6)"
};

/**
 * @hidden
 */
export const main = createLayer("main", function (this: BaseLayer) {
    const grid = persistent([
        [tiles.gray, tiles.gray],
        [tiles.gray, tiles.gray, tiles.gray],
        [tiles.gray, tiles.gray]
    ]);
    return {
        name: "Main",
        minimizable: false,
        classes: { main: true },
        grid,
        display: jsx(() => (
            <>
                <HexGrid gridData={grid.value} selectedColor={tiles.red} />
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
