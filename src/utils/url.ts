/**
 * 处理站点部署在子路径（GitHub Pages 项目仓库）时的链接前缀。
 */
const BASE = import.meta.env.BASE_URL; // 形如 "/" 或 "/my-blog/"

export function withBase(path: string): string {
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return BASE.endsWith('/') ? BASE + clean : BASE + '/' + clean;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replace(/\//g, '-');
}
