<template>
  <view class="gd-page">
    <!-- 画布容器：竖屏时整体旋转 90°，强制变成横屏画面 -->
    <view id="gd-stage" class="gd-stage" :class="{ 'gd-stage--rot': rotated }">
      <view id="phaser-root" class="gd-canvas"></view>
    </view>

    <!-- 全屏入口：点击进入系统全屏并锁定横屏（不支持锁定时由上面的旋转兜底） -->
    <view v-if="showFs" class="gd-fs" @tap="enterFullscreen">
      <text class="gd-fs-ico">⛶</text>
    </view>
  </view>
</template>

<script setup>
import { onMounted, onUnmounted, ref, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { startGame, destroyGame, setForcedRotation } from '@/game/main.js'

const rotated = ref(false)
const showFs = ref(false)

let rafId = 0
let onResize = null
let onFsChange = null
let autoOnce = null

/** 联机参数：?room=123456&name=xxx&create=1&ws=ws://host/ws（同时兼容 hash 前后两种写法） */
onLoad((opt) => {
  const q = new URLSearchParams(location.search)
  const room = (opt && opt.room) || q.get('room') || ''
  const name = (opt && opt.name) || q.get('name') || ''
  const create = (opt && opt.create) || q.get('create') || ''
  const ws = (opt && opt.ws) || q.get('ws') || ''
  window.__GD_ROOM = String(room || '')
  window.__GD_NAME = decodeURIComponent(name || '')
  window.__GD_CREATE = create === '1' || create === 'true'
  // 允许显式指定后端地址（本地联调 / 前后端分开部署时使用）
  if (ws) window.__GD_WS = decodeURIComponent(ws)
})

function isPortrait() {
  const w = window.innerWidth
  const h = window.innerHeight
  return h > w
}

/** 按当前视口重排：竖屏则把舞台旋转成横屏并铺满 */
function layout() {
  const portrait = isPortrait()
  rotated.value = portrait

  const vw = window.innerWidth
  const vh = window.innerHeight
  const el = document.getElementById('gd-stage')
  if (el) {
    // 舞台按「视觉横屏」设置：竖屏时宽=屏高、高=屏宽，再旋转 90° 铺满屏幕
    el.style.width = (portrait ? vh : vw) + 'px'
    el.style.height = (portrait ? vw : vh) + 'px'
  }

  // 等 DOM 完成旋转布局后，再让 Phaser 重新测量并刷新缩放
  nextTick(() => {
    cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => setForcedRotation(portrait ? 90 : 0))
  })
}

/** 进入系统全屏 + 锁定横屏（需在用户手势内调用） */
async function enterFullscreen() {
  try {
    const el = document.documentElement
    if (!document.fullscreenElement && el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: 'hide' })
    }
  } catch (e) { /* 部分浏览器需用户手势，忽略 */ }

  try {
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape')
    }
  } catch (e) { /* iOS Safari 不支持方向锁定，由 CSS 旋转兜底 */ }

  setTimeout(layout, 350)
}

function isMobile() {
  return /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(navigator.userAgent) ||
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
}

onMounted(() => {
  layout()

  onResize = () => layout()
  window.addEventListener('resize', onResize)
  window.addEventListener('orientationchange', onResize)
  onFsChange = () => { showFs.value = !document.fullscreenElement; setTimeout(layout, 250) }
  document.addEventListener('fullscreenchange', onFsChange)
  document.addEventListener('webkitfullscreenchange', onFsChange)

  startGame('phaser-root', {
    onExit: () => {
      uni.navigateBack({
        fail: () => uni.reLaunch({ url: '/pages/guandan/guandan' })
      })
    }
  })

  // 移动端首次交互即自动尝试「全屏 + 锁横屏」，失败则由旋转兜底
  showFs.value = !!document.documentElement.requestFullscreen
  if (isMobile()) {
    autoOnce = () => {
      enterFullscreen()
      document.removeEventListener('touchend', autoOnce)
      document.removeEventListener('click', autoOnce)
    }
    document.addEventListener('touchend', autoOnce, { once: true, passive: true })
    document.addEventListener('click', autoOnce, { once: true })
  }

  // #ifdef APP-PLUS
  try {
    plus.screen.lockOrientation('landscape')
    plus.navigator.setFullscreen(true)
  } catch (e) { /* 忽略 */ }
  // #endif
})

onUnmounted(() => {
  if (onResize) {
    window.removeEventListener('resize', onResize)
    window.removeEventListener('orientationchange', onResize)
  }
  if (onFsChange) {
    document.removeEventListener('fullscreenchange', onFsChange)
    document.removeEventListener('webkitfullscreenchange', onFsChange)
  }
  if (autoOnce) {
    document.removeEventListener('touchend', autoOnce)
    document.removeEventListener('click', autoOnce)
  }
  // #ifdef APP-PLUS
  try { plus.screen.unlockOrientation() } catch (e) { /* 忽略 */ }
  // #endif
  destroyGame()
})
</script>

<style scoped>
.gd-page {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: #06180f;
  overflow: hidden;
}

.gd-stage {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 100vw;
  height: 100vh;
  transform: translate(-50%, -50%);
  transform-origin: 50% 50%;
}

/* 竖屏强制横屏：先定尺寸（宽=屏高、高=屏宽）再整体旋转 90° 铺满 */
.gd-stage--rot {
  transform: translate(-50%, -50%) rotate(90deg);
}

.gd-canvas {
  width: 100%;
  height: 100%;
}

.gd-canvas :deep(canvas) {
  display: block;
  margin: 0 auto;
}

.gd-fs {
  position: absolute;
  right: 8px;
  top: 8px;
  width: 34px;
  height: 34px;
  border-radius: 17px;
  background: rgba(0, 0, 0, .38);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 120;
}

.gd-fs-ico {
  font-size: 18px;
  color: #ffe9a8;
}
</style>
