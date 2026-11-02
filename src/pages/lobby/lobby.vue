<template>
  <view class="lb">
    <view class="lb-bg"></view>

    <view class="lb-head">
      <text class="lb-title">掼 蛋</text>
      <text class="lb-sub">两副牌 · 四人 · 升级</text>
    </view>

    <view class="lb-card">
      <view class="lb-row">
        <text class="lb-label">昵称</text>
        <input class="lb-input" v-model="nick" maxlength="10" placeholder="随便起一个" placeholder-class="ph" />
      </view>

      <view class="lb-row">
        <text class="lb-label">房间号</text>
        <input class="lb-input lb-input--room" v-model="room" type="number" maxlength="6"
               placeholder="6 位数字，留空则创建" placeholder-class="ph" />
      </view>

      <button class="lb-btn lb-btn--primary" @tap="joinOrCreate">
        {{ room ? '进入房间' : '创建房间' }}
      </button>

      <view class="lb-line">
        <text class="lb-or">或</text>
      </view>

      <button class="lb-btn lb-btn--ghost" @tap="playSolo">单机练习（3 个电脑）</button>
    </view>

    <view class="lb-foot">
      <text class="lb-tip">创建房间后，点游戏内「邀请好友」复制链接，或把 6 位房间号发给朋友</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const nick = ref('')
const room = ref('')

onMounted(() => {
  try {
    const saved = uni.getStorageSync('gd_nick')
    if (saved) nick.value = saved
  } catch (e) { /* ignore */ }
  // 邀请链接带 room 参数时自动填入
  const q = parseQuery()
  if (q.room) room.value = String(q.room)
})

function parseQuery() {
  const s = location.search.replace(/^\?/, '')
  const out = {}
  s.split('&').forEach((kv) => {
    if (!kv) return
    const [k, v] = kv.split('=')
    out[k] = decodeURIComponent(v || '')
  })
  return out
}

function genRoom() {
  return String(100000 + Math.floor(Math.random() * 900000))
}

function enterRoom(id) {
  const name = (nick.value || '').trim() || ('玩家' + Math.floor(Math.random() * 9000 + 1000))
  try { uni.setStorageSync('gd_nick', name) } catch (e) { /* ignore */ }
  uni.navigateTo({
    url: '/pages/guandan/guandan?room=' + id + '&name=' + encodeURIComponent(name)
  })
}

function joinOrCreate() {
  let id = String(room.value || '').trim()
  if (!id) id = genRoom()
  if (!/^\d{4,6}$/.test(id)) {
    uni.showToast({ title: '房间号需 4-6 位数字', icon: 'none' })
    return
  }
  enterRoom(id)
}

function playSolo() {
  uni.navigateTo({ url: '/pages/guandan/guandan' })
}
</script>

<style scoped>
.lb {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.lb-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 18%, #1f7a4d 0%, #12543a 42%, #06200f 100%);
}

.lb-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(45deg, rgba(255, 255, 255, .022) 0 2px, transparent 2px 6px);
}

.lb-head {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 34px;
}

.lb-title {
  font-size: 46px;
  font-weight: 700;
  letter-spacing: 12px;
  color: #ffe9b0;
  text-shadow: 0 3px 0 #8c5a12, 0 8px 22px rgba(0, 0, 0, .55);
}

.lb-sub {
  margin-top: 10px;
  font-size: 13px;
  letter-spacing: 3px;
  color: #8fc9ac;
}

.lb-card {
  position: relative;
  z-index: 2;
  width: 84vw;
  max-width: 380px;
  padding: 22px 20px 24px;
  border-radius: 18px;
  background: rgba(6, 30, 18, .82);
  border: 1.5px solid rgba(232, 196, 106, .55);
  box-shadow: 0 18px 44px rgba(0, 0, 0, .45), inset 0 1px 0 rgba(255, 255, 255, .06);
}

.lb-row {
  display: flex;
  align-items: center;
  margin-bottom: 14px;
}

.lb-label {
  width: 62px;
  font-size: 15px;
  color: #9fe6bf;
}

.lb-input {
  flex: 1;
  height: 42px;
  padding: 0 12px;
  font-size: 15px;
  color: #f2fbf6;
  background: rgba(255, 255, 255, .07);
  border: 1px solid rgba(232, 196, 106, .28);
  border-radius: 10px;
}

.lb-input--room {
  letter-spacing: 3px;
  font-weight: 600;
  color: #ffd76a;
}

.ph {
  color: #6d9583;
  font-size: 14px;
  letter-spacing: 0;
}

.lb-btn {
  width: 100%;
  height: 48px;
  line-height: 48px;
  margin-top: 8px;
  border: none;
  border-radius: 12px;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 2px;
}

.lb-btn--primary {
  color: #06280f;
  background: linear-gradient(180deg, #7ce09a 0%, #2f9a5c 100%);
  box-shadow: 0 6px 0 #1b6b3e, 0 10px 20px rgba(0, 0, 0, .35);
}

.lb-btn--ghost {
  color: #d9f2e5;
  background: rgba(255, 255, 255, .08);
  border: 1px solid rgba(232, 196, 106, .35);
}

.lb-line {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 16px 0 6px;
}

.lb-or {
  font-size: 12px;
  color: #6d9583;
  letter-spacing: 2px;
}

.lb-foot {
  position: relative;
  z-index: 2;
  width: 80vw;
  max-width: 360px;
  margin-top: 26px;
}

.lb-tip {
  font-size: 12px;
  line-height: 19px;
  color: #7fae97;
  text-align: center;
}
</style>
