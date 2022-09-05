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
                        <h4>Connected Players</h4>
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
                    </template>
                    <template v-else>
                        <Room
                            v-for="(room, i) in rooms ?? []"
                            :key="i"
                            :room="room"
                            :isPrivate="false"
                            @connect="password => join(room.name, password)"
                        />
                        <div v-if="rooms != null && rooms.length === 0" style="text-align: center">
                            No public rooms found
                        </div>
                        <div v-if="rooms == null" style="text-align: center">
                            Loading public rooms list...
                        </div>
                        <br />
                        <button
                            class="button"
                            style="float: right; display: inline-block"
                            @click="refresh()"
                        >
                            Refresh
                        </button>
                    </template>
                </template>
                <div v-else>
                    Not connected to a server. Please set up networking in the options modal.
                    <br />
                </div>
            </template>
        </template>
        <template v-slot:footer>
            <div class="modal-footer">
                <div v-if="connected && !currentRoom">
                    <br />
                    <hr />
                    <div style="margin-top: 10px; margin-bottom: -10px">Direct Connect</div>
                    <div class="direct-connect field">
                        <Text v-model="directRoomName" placeholder="Room Name" />
                        <Text v-model="directRoomPassword" placeholder="Room Password" />
                        <div class="field-buttons">
                            <button
                                class="button"
                                @click="join(directRoomName, directRoomPassword)"
                            >
                                Connect
                            </button>
                        </div>
                    </div>
                    <div style="margin-top: 10px; margin-bottom: -10px">Host current world</div>
                    <div class="direct-connect field">
                        <Text v-model="hostRoomName" placeholder="Room Name" />
                        <Text v-model="hostRoomPassword" placeholder="Room Password" />
                        <Toggle
                            v-model="hostPrivate"
                            title="Private"
                            style="width: 320px; margin-right: 10px"
                        />
                        <div class="field-buttons">
                            <button
                                class="button"
                                @click="host(hostRoomName, hostRoomPassword, hostPrivate)"
                            >
                                Host
                            </button>
                        </div>
                    </div>
                </div>
                <div class="footer">
                    <div style="flex-grow: 1"></div>
                    <button
                        v-if="currentRoom"
                        class="button modal-default-button"
                        @click="emitToServer('leave room')"
                    >
                        Leave room
                    </button>
                    <button class="button modal-default-button" @click="isOpen = false">
                        Close
                    </button>
                </div>
            </div>
        </template>
    </Modal>
</template>

<script setup lang="ts">
import Text from "components/fields/Text.vue";
import Toggle from "components/fields/Toggle.vue";
import Modal from "components/Modal.vue";
import {
    connected,
    emit as emitToServer,
    getGameState,
    isHosting,
    nicknames,
    room as currentRoom
} from "data/socket";
import { globalBus } from "game/events";
import { PlayerData } from "game/player";
import settings from "game/settings";
import type { ComponentPublicInstance } from "vue";
import { ref, watch } from "vue";
import { main } from "./projEntry";
import Room from "./Room.vue";

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

watch(isOpen, isOpen => {
    if (isOpen) {
        refresh();
    }
});

watch(currentRoom, room => {
    if (!room) {
        directRoomName.value = "";
        directRoomPassword.value = "";
        hostRoomName.value = "";
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
        contentPacks: main.contentPacks.value,
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

.direct-connect :deep(input[type="text"]) {
    margin-right: 10px;
}
</style>
