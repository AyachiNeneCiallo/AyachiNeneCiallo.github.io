/**
 * 站点助手（右下角小挂件）配置
 * 文案都放这里，改字不用碰组件代码。
 */
export const assistantConfig = {
  /** 头像图片，放在 public/ 下 */
  avatar: '/assistant.png',
  /**
   * 点击头像时随机弹出的台词池。
   * 加一句就在这里加一行，点一下随机抽一条。
   */
  greetings: ['Ciallo～(∠・ω< )⌒★', '哇达西诺哦那尼呦迷蝶扣大赛'],
  /** 台词气泡显示时长（毫秒） */
  bubbleDuration: 4000,
  /** 是否避免连续两次抽到同一句（只有一条台词时自动忽略） */
  avoidRepeat: true,
  /**
   * 点击时随机播放的语音（public/ 下的路径）。
   * 留空数组则不出声。一条也会正常播放。
   */
  sounds: ['/voice/oh-nani-1.mp3', '/voice/oh-nani-2.mp3'],
  /** 音量 0~1（0.35 比默认小很多，安静环境刚好） */
  soundVolume: 0.35,
  /** 拖动超过这个像素才算拖动，否则视为点击 */
  dragThreshold: 6,
  /** 首次进入时距右下角的偏移（px），记住位置后不再使用 */
  defaultOffset: { x: 24, y: 24 },
  /** 站内搜索 */
  search: {
    placeholder: '搜索文章标题、内容或标签…',
    empty: '没有找到相关文章',
    loading: '搜索中…',
    shortcutHint: '按 / 或 Ctrl+K 快速搜索',
  },
};
