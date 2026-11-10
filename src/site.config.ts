/**
 * 全站文案与作者信息：只改这一个文件就能改掉大部分可见文字。
 *
 * 关于邮箱：为了避免被爬虫抓取，页面里不出现明文邮箱，而是显示
 * public/email.png 这张图片。邮箱本身只保留在 email 字段里，
 * 改邮箱后要重新生成图片：python make-email-image.py
 */
export const siteConfig = {
  title: 'Ayachi_Nene_ciallo的博客',
  description: 'Ciallo～(∠・ω< )⌒★',
  author: 'Ayachi_Nene_ciallo',

  /** 个人信息（关于页用） */
  github: 'https://github.com/AyachiNeneCiallo/',
  /** 邮箱只用于生成 email.png，不会输出到 HTML */
  email: 'AyachiNeneCiallo0721@gmail.com',
  /** 展示用邮箱图片（public/ 下） */
  emailImage: '/email.png',
  /** 图片的替代文字，也别写完整邮箱 */
  emailLabel: '邮箱',

  /** 导航栏，按顺序渲染 */
  nav: [
    { label: '首页', href: '/' },
    { label: '标签', href: '/tags/' },
    { label: '关于', href: '/about/' },
  ],
  /**
   * 友链（页脚右侧）
   * ------------------------------------------------------------
   * 想加就加一项，按顺序渲染；留空数组则整块不显示。
   *   { label: '显示名', href: 'https://…' }
   */
  friends: [
    { label: 'monopolize的博客', href: 'https://monopolize7789.github.io/' },
  ] as Array<{ label: string; href: string }>,
  /** 首页每页文章数 */
  pageSize: 10,

  /**
   * 背景图（可选）
   * ------------------------------------------------------------
   * 用法：把图片放进 public/（比如 public/bg.webp），然后填 '/bg.webp'。
   * 设为 null 或空字符串就是纯白背景。
   *
   * 其他选项：
   *   backgroundSize      cover / contain / auto，默认 cover
   *   backgroundPosition  默认 center
   *   backgroundOverlay   盖在背景图上的一层半透明白色，用来压暗花纹、
   *                       保证正文可读性。0 = 不盖，1 = 全白。
   */
  background: {
    image: '/bg.webp' as string | null,
    /**
     * 手机端（≤640px）单独用这张背景图。
     * 桌面那张是横构图，竖屏下只能看到人物脸的一角；这张是站姿竖构图，
     * 放进手机上更完整。设 null = 手机也用 image。
     */
    imageMobile: '/bg-mobile.webp' as string | null,
    size: 'cover',
    position: 'center',
    /**
     * 手机端（≤640px）单独用这套取景。
     * 竖屏时 cover 只在横向裁切、纵向没余量，人物的脸固定在屏幕 25%~50% 高度处。
     * 全局样式里给首页标题区在手机上留了一块空白（.page-subtitle 下边距），
     * 让脸正好落在这块只有玻璃、没有白卡的区域里；这里只把人物横向摆到中间。
     * 设 null = 沿用上面的 size / position。
     */
    sizeMobile: null as string | null,
    positionMobile: '57% center' as string | null,
    overlay: 0.38,
    /** 背景图是否跟着页面滚动（false = 固定在视口） */
    fixed: true,
  },
};

export type SiteConfig = typeof siteConfig;
