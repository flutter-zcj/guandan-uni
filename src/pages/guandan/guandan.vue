<template>
  <view class="gd-page">
    <!-- Phaser 画布挂载点 -->
    <view id="phaser-root" class="gd-canvas"></view>

    <!-- 竖屏时提示旋转 -->
    <view v-if="needLandscape" class="gd-rotate">
      <text class="gd-rotate-icon">⟳</text>
      <text class="gd-rotate-txt">请横屏游玩，体验更佳</text>
    </view>
  </view>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { startGame, destroyGame } from '@/game/main.js'

const needLandscape = ref(false)

function checkOrient() {
  // #ifdef H5
  const w = window.innerWidth
  const h = window.innerHeight
  needLandscape.value = h > w && w < 820
  // #endif
}

let onResize = null

onMounted(() => {
  checkOrient()
  // #ifdef H5
  onResize = () => {
    checkOrient()
    window.dispatchEvent(new Event('resize'))
  }
  window.addEventListener('resize', onResize)
  window.addEventListener('orientationchange', onResize)
  startGame('phaser-root', {
    onExit: () => {
      uni.navigateBack({
        fail: () => uni.reLaunch({ url: '/pages/guandan/guandan' })
      })
    }
  })
  // #endif
})

onUnmounted(() => {
  // #ifdef H5
  if (onResize) {
    window.removeEventListener('resize', onResize)
    window.removeEventListener('orientationchange', onResize)
  }
  // #endif
  destroyGame()
})
</script>

<style scoped>
.gd-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: #06180f;
  overflow: hidden;
}

.gd-canvas {
  width: 100%;
  height: 100%;
}

.gd-canvas :deep(canvas) {
  display: block;
  margin: 0 auto;
}

.gd-rotate {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #06180f;
  z-index: 99;
}

.gd-rotate-icon {
  font-size: 60px;
  color: #ffd76a;
  margin-bottom: 16px;
}

.gd-rotate-txt {
  font-size: 16px;
  color: #cfeee0;
}
</style>
