<template>
    <div class="chat" :class="{ open }" v-show="room">
        <div class="chat-toggle" @click="open = !open">
            <span>Chat</span>
            <span v-if="unread" style="margin-left: 10px">[{{ unread > 9 ? "9+" : unread }}]</span>
        </div>
        <div class="chat-messages" ref="scroll" @scroll.passive="onScroll">
            <div v-for="(message, i) in messages" :key="i" class="chat-message-container">
                <span class="chat-user" v-if="message.user">{{ nicknames[message.user] }}</span>
                <span class="chat-message" :style="message.user ? '' : 'font-style: italic'">{{
                    message.message
                }}</span>
            </div>
        </div>
        <hr style="margin-top: 0" />
        <div class="chat-submit">
            <Text v-model="message" @submit="submit" :submitOnBlur="false" />
            <button @pointerdown="submit" class="button">
                <span class="material-icons">check</span>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import Text from "components/fields/Text.vue";
import { globalBus } from "game/events";
import { nextTick, reactive, ref, watch } from "vue";
import { emit, nicknames, room } from "./socket";

const open = ref<boolean>(false);
const unread = ref<number>(0);

const message = ref("");
const messages = reactive<{ user?: string; message: string }[]>([]);
const scroll = ref<HTMLElement | null>(null);

function submit() {
    emit("chat", message.value);
    message.value = "";
}

globalBus.on("chat", (user, message) => {
    messages.push({ user, message });
    const atBottom =
        scroll.value &&
        scroll.value.scrollTop >= scroll.value.scrollHeight - scroll.value.clientHeight;
    if (atBottom) {
        nextTick(() => {
            if (scroll.value) {
                scroll.value.scrollTop = scroll.value.scrollHeight - scroll.value.clientHeight;
            }
        });
    }
    if ((!atBottom || !open.value) && user) {
        unread.value++;
    }
});

function onScroll() {
    nextTick(() => {
        if (
            scroll.value &&
            unread.value > 0 &&
            scroll.value.scrollTop >= scroll.value.scrollHeight - scroll.value.clientHeight
        ) {
            unread.value = 0;
        }
    });
}

watch(open, open => {
    if (open) {
        unread.value = 0;
    }
});
</script>

<style scoped>
.chat {
    position: fixed;
    top: 100%;
    right: 4px;
    height: 500px;
    width: 300px;
    border: solid 1px var(--outline);
    display: flex;
    flex-flow: column;
    background: var(--background);
}

.chat.open {
    top: calc(100% - 500px);
}

.chat-toggle {
    margin-top: -23px;
    margin-left: -1px;
    margin-right: -1px;
    border-top-left-radius: var(--border-radius);
    border-top-right-radius: var(--border-radius);
    border: solid 1px var(--outline);
    cursor: pointer;
    user-select: none;
    background: var(--background);
}

.chat-messages {
    flex-grow: 1;
    width: calc(100% - 8px);
    padding: 4px;
    word-break: break-all;
    overflow-y: auto;
}

.chat-message-container {
    font-size: smaller;
    text-align: left;
    margin-bottom: 4px;
}

.chat-user {
    font-weight: bolder;
    margin-right: 10px;
}

.chat-message {
    font-weight: lighter;
}

.chat-submit {
    display: flex;
    width: 100%;
}

.chat-submit > form {
    margin-left: 10px;
}
</style>
