<style lang="scss" scoped>
.login-container { position: relative; display: flex; flex-direction: column; width: 100%; min-height: 100vh; padding: 0 60rpx; background: #ffffff; box-sizing: border-box; }
.header-section { position: relative; display: flex; flex-direction: column; align-items: center; margin-top: 160rpx; margin-bottom: 80rpx; }
.logo-image { width: 160rpx; height: 160rpx; margin-bottom: 40rpx; border-radius: 32rpx; }
.welcome-title { font-size: 48rpx; font-weight: 600; color: #333333; }
.welcome-subtitle { font-size: 28rpx; color: #999999; margin-top: 16rpx; }
.form-section { position: relative; display: flex; flex-direction: column; gap: 40rpx; }
.input-item { position: relative; width: 100%; }
.action-options { position: relative; display: flex; align-items: center; justify-content: space-between; margin-top: 24rpx; }
.option-text { font-size: 26rpx; color: #666666; }
.forgot-password { font-size: 26rpx; color: #1AA86C; }
.submit-section { position: relative; margin-top: 80rpx; }
.footer-section { position: relative; display: flex; justify-content: center; margin-top: 60rpx; }
.register-hint { font-size: 26rpx; color: #999999; }
.register-link { font-size: 26rpx; font-weight: 500; color: #1AA86C; margin-left: 12rpx; }
</style>
<template>
  <view class="login-container">
    <!-- 🚀 头部 Logo 及 欢迎语 -->
    <view class="header-section">
      <image
        src="/static/logo.png"
        class="logo-image"
        mode="aspectFit"
      />
      <text class="welcome-title">欢迎回来</text>
      <text class="welcome-subtitle">请登录您的账号以继续</text>
    </view>

    <!-- 🚀 登录表单区域 -->
    <view class="form-section">
      <view class="input-item">
        <u-input
          v-model="account"
          placeholder="请输入账号"
          prefix-icon="account"
          border="bottom"
          clearable
        />
      </view>
      <view class="input-item">
        <u-input
          v-model="password"
          placeholder="请输入密码"
          type="password"
          prefix-icon="lock"
          border="bottom"
          clearable
        />
      </view>
    </view>

    <!-- 🚀 额外操作选项 -->
    <view class="action-options">
      <view class="option-text">
        <u-checkbox-group v-model="rememberMeGroup">
          <u-checkbox
            name="remember"
            label="记住密码"
            active-color="#1AA86C"
            size="32rpx"
            label-size="26rpx"
          />
        </u-checkbox-group>
      </view>
      <text
        class="forgot-password"
        @click="handleForgotPassword"
      >
        忘记密码？
      </text>
    </view>

    <!-- 🚀 提交按钮 -->
    <view class="submit-section">
      <u-button
        text="登录"
        type="primary"
        color="#1AA86C"
        shape="circle"
        @click="handleLogin"
      />
    </view>

    <!-- 🚀 底部注册跳转 -->
    <view class="footer-section">
      <text class="register-hint">还没有账号？</text>
      <text
        class="register-link"
        @click="handleRegister"
      >
        立即注册
      </text>
    </view>
  </view>
</template>
<script>
/**
 * 组件名称：login
 * 功能说明：用户登录页面，提供账号密码登录及注册跳转功能
 * 研发时间：2026/04/24
 * 研发人员：Antigravity
 *
 * 参数说明：
 * @prop {String} account - 登录账号
 * @prop {String} password - 登录密码
 * @prop {Array} rememberMeGroup - 记住密码复选框组（u-checkbox-group 绑定值）
 *
 * 事件说明：
 * @event handleLogin - 处理登录按钮点击，执行身份验证
 * @event handleForgotPassword - 处理忘记密码点击，跳转至找回密码页面
 * @event handleRegister - 处理立即注册点击，跳转至账号注册页面
 *
 * 插槽说明：
 */

/**
 * 修改时间       人员        说明
 * 2026/04/24     Antigravity  初始创建，完成基础登录布局与逻辑
 */

export default
{
  data()
  {
    return {
      account: '',
      password: '',
      rememberMeGroup: []
    }
  },

  methods:
  {
    /**
     * 处理登录逻辑
     * 校验账号密码并调用登录接口
     */
    handleLogin()
    {
      if (!this.account || !this.password)
      {
        uni.showToast({ title: '请输入账号和密码', icon: 'none' })
        return
      }

      // 模拟登录成功逻辑
      uni.showLoading({ title: '登录中...' })
      setTimeout(() =>
      {
        uni.hideLoading()
        uni.showToast({ title: '登录成功', icon: 'success' })
        // uni.switchTab({ url: '/pages/index/index' })
      }, 1500)
    },

    /**
     * 处理忘记密码跳转
     */
    handleForgotPassword()
    {
      uni.showToast({ title: '功能开发中', icon: 'none' })
    },

    /**
     * 处理注册页面跳转
     */
    handleRegister()
    {
      uni.showToast({ title: '功能开发中', icon: 'none' })
    }
  }
}
</script>
