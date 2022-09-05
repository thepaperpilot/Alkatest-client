import Text from "components/fields/Text.vue";
import { jsx, setDefault } from "features/feature";
import { globalBus } from "game/events";
import settings, { registerSettingField } from "game/settings";
import { io, Socket } from "socket.io-client";
import { load } from "util/save";
import { ref, watch } from "vue";
import { uniqueNamesGenerator, adjectives, colors, animals } from "unique-names-generator";
import player from "game/player";
import { useToast } from "vue-toastification";
import { ProxyState } from "util/proxies";
import satisfies from "semver/functions/satisfies";
import projInfo from "data/projInfo.json";

export const connected = ref<boolean>(false);
export const room = ref<string | null>(null);
export const isHosting = ref<boolean>(false);
export const nicknames = ref<Record<string, string>>({});

const toast = useToast();

const socket = ref<Socket<ServerToClientEvents, ClientToServerEvents> | null>();
const connectionError = ref<string>("");

export function emit<T extends keyof ClientToServerEvents>(
    event: T,
    ...args: Parameters<ClientToServerEvents[T]>
): void {
    if (!connected.value) {
        return;
    }
    socket.value?.emit(event, ...args);
}

export function getGameState(): GameState {
    return player.layers.main[ProxyState] as unknown as GameState;
}

globalBus.on("loadSettings", settings => {
    setDefault(settings, "server", window.location.origin);
    setDefault(settings, "nickname", randomName());

    watch(
        () => settings.server,
        server => {
            if (socket.value) {
                socket.value.close();
            }

            socket.value = io(server);
            setupSocket(socket.value);

            connected.value = false;
            connectionError.value = "";
            socket.value.connect();
        },
        { immediate: true }
    );

    watch(
        () => settings.nickname,
        nickname => {
            if (room.value) {
                emit("set nickname", nickname);
            }
        }
    );

    registerSettingField(
        jsx(() => (
            <>
                <Text
                    title="Server URL"
                    onUpdate:modelValue={value => (settings.server = value)}
                    modelValue={settings.server}
                />
                <div style="font-style: italic; font-size: small; margin-top: -10px;">
                    {connected.value ? (
                        <span>Connected!</span>
                    ) : connectionError.value ? (
                        <span style="color: red">{connectionError.value}</span>
                    ) : (
                        <span>Connecting...</span>
                    )}
                </div>
            </>
        ))
    );
    registerSettingField(
        jsx(() => (
            <>
                <Text
                    title={jsx(() => (
                        <span>
                            Nickname
                            <button
                                class="button"
                                style="position: absolute; right: 0px; top: 2px;"
                                onClick={() => (settings.nickname = randomName())}
                            >
                                <span class="material-icons">casino</span>
                            </button>
                        </span>
                    ))}
                    onUpdate:modelValue={value => (settings.nickname = value)}
                    modelValue={settings.nickname}
                />
            </>
        ))
    );
});

function setupSocket(socket: Socket<ServerToClientEvents, ClientToServerEvents>) {
    socket.on("connect", () => {
        connectionError.value = "";
        connected.value = true;
    });
    socket.on("connect_error", error => {
        connectionError.value = `${error.name}: ${error.message}`;
    });
    socket.on("disconnect", (reason, details) => {
        connectionError.value =
            details instanceof Error
                ? `${details.name}: ${details.message}`
                : details?.description ?? reason;
        connected.value = false;
    });
    socket.on("server version", semver => {
        if (!satisfies(projInfo.versionNumber, semver)) {
            toast.info("Server only accepts game versions in range: " + semver);
            socket.disconnect();
        }
    });

    socket.on("info", message => {
        toast.info(message);
        globalBus.emit("serverSentInfo");
    });
    socket.on("set rooms", rooms => {
        globalBus.emit("setRooms", rooms);
    });
    socket.on("joined room", (r, hosting) => {
        room.value = r;
        isHosting.value = hosting;
    });
    socket.on("left room", () => {
        room.value = null;
    });
    socket.on("set nicknames", n => {
        nicknames.value = n;
    });
}

function randomName(): string {
    return uniqueNamesGenerator({
        dictionaries: [adjectives, colors, animals],
        length: 3,
        separator: " ",
        style: "capital"
    });
}

watch(connected, connected => {
    if (!connected && room.value) {
        stopMultiplayer();
    }
});

function stopMultiplayer() {
    if (!isHosting.value) {
        load();
    }
    room.value = null;
    isHosting.value = false;
}

declare module "game/settings" {
    interface Settings {
        server: string;
        nickname: string;
    }
}

declare module "game/events" {
    interface GlobalEvents {
        openMultiplayer: VoidFunction;
        setRooms: (rooms: ClientRoomData[]) => void;
        serverSentInfo: VoidFunction;
    }
}
