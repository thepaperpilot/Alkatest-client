<template>
    <Modal v-model="isOpen" ref="modal">
        <template v-slot:header>
            <h2>Multiplayer</h2>
        </template>
        <template #body="{ shown }">
            <template v-if="shown">
                <template v-if="connected">
                    <template v-if="currentRoom">
                        <div style="text-align: center">
                            <h3>Connected to {{ currentRoom }}</h3>
                        </div>
                        <br />
                        <ul class="players-list">
                            <div v-for="(nickname, i) in nicknames" :key="i" style="display: flex">
                                <span>{{ nickname }}</span>
                                <span
                                    v-if="nickname === settings.nickname"
                                    style="font-size: small; color: grey; margin-left: 10px"
                                    >(YOU)</span
                                >
                                <div style="flex-grow: 1"></div>
                                <button
                                    v-if="isHosting && nickname !== settings.nickname"
                                    class="button"
                                    style="color: red; display: inline"
                                    @click="emitToServer('kick user', nickname)"
                                >
                                    KICK
                                </button>
                            </div>
                        </ul>
                        <br />
                        <button
                            class="button large"
                            @click="() => host(hostRoomName, hostRoomPassword, hostPrivate)"
                        >
                            {{ isHosting ? "Close" : "Leave" }} room
                        </button>
                    </template>
                    <component v-else :is="render(tabs)" />
                </template>
                <div v-else>
                    Not connected to a server. Please set up networking in the options modal.
                    <br />
                </div>
            </template>
        </template>
        <template v-slot:footer>
            <div class="modal-footer">
                <div class="footer">
                    <div style="flex-grow: 1"></div>
                    <button class="button modal-default-button" @click="isOpen = false">
                        Close
                    </button>
                </div>
            </div>
        </template>
    </Modal>
</template>

<script setup lang="tsx">
import Modal from "components/Modal.vue";
import Text from "components/fields/Text.vue";
import Toggle from "components/fields/Toggle.vue";
import {
    connected,
    room as currentRoom,
    emit as emitToServer,
    getGameState,
    isHosting,
    nicknames
} from "data/socket";
import { jsx } from "features/feature";
import { createTabFamily } from "features/tabs/tabFamily";
import { globalBus } from "game/events";
import player, { PlayerData } from "game/player";
import settings from "game/settings";
import { render } from "util/vue";
import type { ComponentPublicInstance } from "vue";
import { ref, watch } from "vue";
import Room from "./Room.vue";

// For some reason it won't find the interface from chromatic-common
interface ClientRoomData {
    name: string;
    host: string;
    hasPassword: boolean;
}

export type LoadablePlayerData = Omit<Partial<PlayerData>, "id"> & { id: string; error?: unknown };

const isOpen = ref(false);
const modal = ref<ComponentPublicInstance<typeof Modal> | null>(null);

defineExpose({
    open() {
        isOpen.value = true;
    }
});

const rooms = ref<ClientRoomData[] | null>(null);
const directRoomName = ref("");
const directRoomPassword = ref("");
const hostRoomName = ref("");
const hostRoomPassword = ref("");
const hostPrivate = ref<boolean>(false);

const tabs = createTabFamily(
    {
        roomList: () => ({
            display: "Room List",
            tab: jsx(() => (
                <>
                    {(rooms.value ?? []).map(r => (
                        <Room
                            room={r}
                            isPrivate={false}
                            onConnect={password => join(r.name, password)}
                        />
                    ))}
                    {rooms.value != null && rooms.value.length === 0 ? (
                        <div style="text-align: center">No public rooms found</div>
                    ) : null}
                    {rooms.value == null ? (
                        <div style="text-align: center">Loading public rooms list...</div>
                    ) : null}
                    <br />
                    <button class="button large" onClick={refresh}>
                        Refresh
                    </button>
                </>
            ))
        }),
        direct: () => ({
            display: "Private Room",
            tab: jsx(() => (
                <>
                    <div class="direct-connect">
                        <div class="field">
                            <Text
                                onUpdate:modelValue={value => (directRoomName.value = value)}
                                modelValue={directRoomName.value}
                                title="Room Name"
                            />
                        </div>
                        <div class="field">
                            <Text
                                onUpdate:modelValue={value => (directRoomPassword.value = value)}
                                modelValue={directRoomPassword.value}
                                title="Room Password"
                            />
                        </div>
                        <button
                            class="button large"
                            onClick={() => join(directRoomName.value, directRoomPassword.value)}
                        >
                            Connect
                        </button>
                    </div>
                </>
            ))
        }),
        host: () => ({
            display: "Host",
            tab: jsx(() => (
                <>
                    <div class="field">
                        <Text
                            onUpdate:modelValue={value => (hostRoomName.value = value)}
                            modelValue={hostRoomName.value}
                            title="Room Name"
                        />
                    </div>
                    <div class="field">
                        <Text
                            onUpdate:modelValue={value => (hostRoomPassword.value = value)}
                            modelValue={hostRoomPassword.value}
                            title="Room Password"
                        />
                    </div>
                    <Toggle
                        onUpdate:modelValue={value => (hostPrivate.value = value)}
                        modelValue={hostPrivate.value}
                        title="Private"
                    />
                    <div style="font-size: small">
                        You will host the currently active single player world, allowing other
                        players to join and modify your save. It is recommended to backup your save
                        frequently.
                    </div>
                    <br />
                    <button
                        class="button large"
                        onClick={() =>
                            host(hostRoomName.value, hostRoomPassword.value, hostPrivate.value)
                        }
                    >
                        Host
                    </button>
                </>
            ))
        })
    },
    () => ({
        style: "margin-left: 0; margin-right: 0; --layer-color: var(--link)"
    })
);

watch([isOpen, tabs.selected], ([isOpen, currentTab]) => {
    if (isOpen && currentTab === "roomList") {
        refresh();
    } else if (isOpen && currentTab === "host") {
        hostRoomName.value = `${settings.nickname}'s ${player.name}`;
    }
});

watch(currentRoom, room => {
    if (!room) {
        directRoomName.value = "";
        directRoomPassword.value = "";
        hostRoomName.value = `${settings.nickname}'s ${player.name}`;
        hostRoomPassword.value = "";
        refresh();
    }
});

globalBus.on("setRooms", r => (rooms.value = r));
globalBus.on("serverSentInfo", () => {
    if (isOpen.value) {
        refresh();
    }
});

function refresh() {
    rooms.value = null;
    emitToServer("get rooms");
}

function join(room: string, password?: string) {
    emitToServer("connect to room", room, password, settings.nickname);
}

function host(room: string, password?: string, privateRoom?: boolean) {
    emitToServer("create room", {
        name: room,
        password,
        nickname: settings.nickname,
        privateRoom: privateRoom === true,
        state: getGameState()
    });
}
</script>

<style scoped>
.field form,
.field .field-title,
.field .field-buttons {
    margin: 0;
}

.field-buttons {
    display: flex;
}

.field-buttons .field {
    margin: 0;
    margin-left: 8px;
}

.modal-footer {
    margin-top: -20px;
}

.footer {
    display: flex;
    margin-top: 20px;
}

.field-title {
    white-space: nowrap;
}
</style>

<style>
.large.button {
    font-size: large;
    width: 100%;
    background: var(--feature-background);
    border-radius: var(--border-radius);
}

.large.button:hover {
    background: var(--highlighted);
    text-shadow: unset;
}
</style>
