<template>
    <div class="grid">
        <div v-for="(row, rowIndex) in gridData" :key="rowIndex" class="row">
            <div
                v-for="(color, colIndex) in row"
                :key="`${rowIndex}-${colIndex}-${color}`"
                class="hexagon-wrapper"
                :style="{ '--color': color }"
                @click="updateColor(rowIndex, colIndex)"
                @mouseover="setHoveredCell(rowIndex, colIndex)"
                @mouseout="resetHoveredCell"
            >
                <div class="hexagon" :style="{ backgroundColor: color }"></div>
                <transition name="fade">
                    <div
                        v-if="
                            hoveredCell?.row === rowIndex &&
                            hoveredCell?.col === colIndex &&
                            color !== selectedColor
                        "
                        class="hexagon-overlay"
                        :style="{ '--color': selectedColor }"
                    >
                        <div class="hexagon" :style="{ backgroundColor: selectedColor }"></div>
                    </div>
                </transition>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, toRefs } from "vue";

const props = defineProps<{
    gridData: string[][];
    selectedColor: string;
}>();

const emit = defineEmits<{
    (event: "updateColor", row: number, col: number, color: string): void;
}>();

const { selectedColor } = toRefs(props);
const hoveredCell = ref<{ row: number; col: number } | null>(null);

function updateColor(row: number, col: number) {
    emit("updateColor", row, col, selectedColor.value);
}

function setHoveredCell(row: number, col: number) {
    hoveredCell.value = { row, col };
}

function resetHoveredCell() {
    hoveredCell.value = null;
}
</script>

<style scoped>
.grid {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.row {
    margin-top: -1vw;
}

.hexagon-wrapper {
    position: relative;
    width: 5vw;
    height: 5vw;
    margin: 0.2vw;
}

.hexagon-wrapper::before,
.hexagon-wrapper::after,
.hexagon-overlay::before,
.hexagon-overlay::after {
    content: "";
    position: absolute;
    bottom: 0.1vw;
    width: 50%;
    height: 0.6vw;
    backdrop-filter: blur(3px);
    background-color: var(--color);
    transform-origin: bottom;
    pointer-events: none;
    z-index: -1;
}

.hexagon-wrapper::before,
.hexagon-overlay::before {
    left: 0;
    transform: skewY(26.5deg);
    filter: brightness(85%);
}

.hexagon-wrapper::after,
.hexagon-overlay::after {
    right: 0;
    transform: skewY(-26.5deg);
    filter: brightness(65%);
}

.hexagon {
    position: relative;
    width: 100%;
    height: 100%;
    backdrop-filter: blur(3px);
    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
}

.hexagon-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    opacity: 0.5;
    pointer-events: none;
    animation: bounce 1s infinite;
}

/* for some reason the transition is instant sometimes when hovering stops */
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

@keyframes bounce {
    0%, 100% {
        transform: translateY(-15px);
    }
    50% {
        transform: translateY(-7.5px);
    }
}
</style>
