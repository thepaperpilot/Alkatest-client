<template>
    <div class="room">
        <div class="actions" v-if="enteringPassword">
            <button @pointerdown="submitPassword" class="button">
                <Tooltip display="Join" :direction="Direction.Left" class="info">
                    <span class="material-icons">check</span>
                </Tooltip>
            </button>
            <button @pointerdown="enteringPassword = !enteringPassword" class="button">
                <Tooltip display="Cancel" :direction="Direction.Left" class="info">
                    <span class="material-icons">close</span>
                </Tooltip>
            </button>
        </div>
        <div class="details" v-if="!enteringPassword">
            <span class="material-icons" v-if="room.hasPassword">lock</span>
            <span class="material-icons" v-if="isPrivate">visibility_off</span>
            <button class="button open" @click="startConnecting">
                <h3>{{ room.name }}</h3>
            </button>
            <div class="room-host">Hosted by {{ room.host }}</div>
            <div class="room-host">{{ room.numContentPacks }} active content packs</div>
        </div>
        <div v-else class="details" style="display: flex">
            <span>Password:</span>
            <Text
                v-model="password"
                class="editname"
                @submit="submitPassword"
                @cancel="enteringPassword = !enteringPassword"
                :submitOnBlur="false"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, toRefs, watch } from "vue";
import Text from "components/fields/Text.vue";
import { Direction } from "util/common";
import Tooltip from "features/tooltips/Tooltip.vue";
import { ClientRoomData } from "alkatest-common/types";

const _props = defineProps<{
    isPrivate: boolean;
    room: ClientRoomData;
}>();
const { room } = toRefs(_props);
const emit = defineEmits<{
    (e: "connect", password?: string): void;
}>();

const enteringPassword = ref(false);
const password = ref("");

watch(enteringPassword, enteringPassword => {
    if (enteringPassword) {
        password.value = "";
    }
});

function startConnecting() {
    if (room.value.hasPassword) {
        enteringPassword.value = true;
    } else {
        emit("connect");
    }
}

function submitPassword() {
    emit("connect", password.value);
    enteringPassword.value = false;
}
</script>

<style scoped>
.room {
    position: relative;
    border: solid 4px var(--outline);
    padding: 4px;
    background: var(--raised-background);
    margin: var(--feature-margin);
    display: flex;
    align-items: center;
    min-height: 30px;
}

.room.active {
    border-color: var(--bought);
}

.open {
    display: inline;
    margin: 0;
    padding-left: 0;
}

.details {
    margin: 0;
    flex-grow: 1;
    margin-right: 80px;
}

.details .material-icons {
    font-size: 20px;
    margin-right: 4px;
    transform: translateY(2px);
}

.room-host {
    font-size: 0.7em;
    opacity: 0.7;
}

.actions {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 4px;
    display: flex;
    padding: 4px;
    z-index: 1;
}

.editname {
    margin: 0;
}
</style>

<style>
.room button {
    transition-duration: 0s;
}

.room .actions button {
    display: flex;
    font-size: 1.2em;
}

.room .actions button .material-icons {
    font-size: unset;
}

.room .button.danger {
    display: flex;
    align-items: center;
    padding: 4px;
}

.room .field {
    margin: 0;
}
</style>
