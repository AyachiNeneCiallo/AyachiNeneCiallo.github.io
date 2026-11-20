---
title: "把生图流程打包成双击就能用的小工具"
description: "从 QQ 机器人里拆出来的本地生图工作室：中文翻译、ComfyUI 调度、显存互斥、打包分发的完整踩坑记录"
pubDate: 2026-11-20
tags: ["AI 绘画","ComfyUI","折腾记录"]
cover: "/gallery/05-image-4.png"
---
**这个封面就是这个工作流做出来的**\
之前这套东西是挂在 QQ 机器人里的：群里发一句中文，机器人翻译成 Danbooru 标签，丢给 ComfyUI 出图，再把图发回群里。

用久了发现一个问题——它本可以不依赖 QQ。于是花了几天把它拆出来，做成一个解压就能用的小工具：网页界面、本地翻译、本地出图，不联网也能跑（下完模型之后）。

## 用起来是什么样

打开就是这样一个页面：

- 左边中文描述 → 点「翻译为标签」→ 得到英文 tag
- 选底模（WAI / NoobAI）、尺寸、步数，点「生成图片」
- 右边是角色提示词面板：给 LoRA 绑定一份 TXT，切到对应 LoRA 自动显示
- 右下角有个小助手，点开是一排功能说明

![翻译与角色提示词面板](/images/image-studio/01-translate.png)


技术栈很土，但很稳：

| 部分 | 选择 | 理由 |
|---|---|---|
| 后端 | Node 原生 `http`，**零 npm 依赖** | 便携包里不用带 `node_modules`，双击就能跑 |
| 前端 | 单个 `index.html`，原生 JS | 不用构建，改完刷新就生效 |
| 出图 | 本地 ComfyUI（便携版） | 生态最全，直接调它的 HTTP API |
| 翻译 | 本地 `llama-server` + Qwen3 GGUF | 离线，不用付 API 钱，也不怕隐私 |

## 出图与预览

生成结果在下面，缩略图点开可以放大看细节：

![生成结果与 LoRA 管理](/images/image-studio/02-result.png)

![点击图片放大预览](/images/image-studio/03-preview.png)
## 显存是唯一的硬约束

整件事最难的不是调 ComfyUI 接口，而是**显存**。

翻译模型和出图模型都要吃显存，8 GB 的卡上两个同时驻留必炸。所以整套东西的核心逻辑其实是「显存调度」：

```js
// 生图前：先关翻译实例
await stopLlm();
await startComfyUi();

// 翻译前：先关 ComfyUI
await stopComfyUi('翻译前释放显存');
await ensureLlm();
```

翻译完立刻释放：

```js
releaseLlm('翻译完成');
```

一开始只做了「生图前关翻译」，忘了反向操作——结果出完图再用翻译，显存被 ComfyUI 占着，`llama-server` 只能降层数硬撑，慢到怀疑人生。

后来加了「空闲关闭」：生图结束起个定时器，默认 **120 秒**没人用就把 ComfyUI 关掉，把显存还回去。

```js
function scheduleComfyIdleStop(reason = '') {
  const sec = Number(cfg.image?.comfyui?.idleStopSeconds ?? 120);
  cancelComfyIdleStop();
  if (!(sec > 0)) return;
  comfyIdleTimer = setTimeout(async () => {
    comfyIdleTimer = null;
    if (await checkComfyUI({ timeoutMs: 800 }).catch(() => false)) {
      await stopComfyUi(`空闲 ${sec}s`);
    }
  }, sec * 1000);
}
```

这里还翻了个车：判断「ComfyUI 在不在跑」的代码只查了 `pythonw.exe`，但便携版实际跑的是 **`python.exe`**，所以关不掉、也兜底不了。最后改成按命令行匹配：

```powershell
Get-CimInstance Win32_Process |
  Where-Object { $_.Name -eq 'python.exe' -and $_.CommandLine -like '*ComfyUI*main.py*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

## 翻译模型：从 27B 一路退到 8B

一开始想上大模型提升翻译质量，结果：

| 模型 | 结果 |
|---|---|
| Qwen3.8-27B IQ3_M（13.8 GB） | 12 GB 卡只能部分 offload，单句 60 秒超时，删 |
| Qwen3-14B Q5_K_M（9.8 GB） | 43.6 秒，而且输出还错了，删 |
| Qwen3-4B / 1.7B | 输出乱码或干脆用英文解释一遍规则，删 |
| **Qwen3-8B Heretic Q5_K_M（5.5 GB）** | 3~10 秒，稳定，留下 |

最后用的是 **heretic（去审查）版本**——翻译成人向 tag 时原版会拒答，选个不废话的版本更省时间。

翻译层还有两个坑：

1. **模型会照抄示例**。few-shot 里放了一句「一个女孩站在海边」，它就把 `1girl, blue eyes, school uniform` 原封不动抄进结果。后来在系统提示里声明「示例只示范格式」，再加一层防抄写检测（输出与示例 tag 重合 ≥80% 就重试）。
2. **权重丢失**。`(white eyes:1.2)` 被翻译成 `(rolling eyes)`，权重没了。修法是保留括号权重，同名 tag 取最大权重。

## 前端那些离谱的小问题

- **整段 JS 突然失效**：模板字符串里混进了一个全角 `’`，浏览器直接语法报错，页面看起来正常但按钮全没反应。
- **头像有个蓝底**：小助手的头像被全局 `button:hover` 样式染成了蓝色圆角块。因为 `button:hover`（0,1,1）优先级高于 `.assistant__avatar`（0,1,0），最后用显式覆盖 + `!important` 解决。
- **点图不能放大**：加了个灯箱，在 `#gallery` 上做事件委托，不用给每张图绑事件。

右下角的小助手长这样，八个按钮点开就是对应的用法：

![小助手面板](/images/image-studio/04-assistant.png)

![点开一个主题](/images/image-studio/05-assistant-topic.png)

## 输出目录会无限长大

ComfyUI 默认把每张图都写进 `output/`，用久了就是几个 G。

但这套流程里，图是 base64 直接回给浏览器的，**服务端那张其实没用**。所以生成完就删：

```js
for (const img of imgs) if (deleteOutputFile(img)) killed += 1;
```

再加一层兜底：启动时按「保留 7 天 / 最多 200 张」清理一次，界面上也留了个「清理服务端输出图」按钮。

## 怎么分给别人

本来想直接压一个 20 GB 的包，后来想想算了：

- GitHub 单文件上限 100 MB，LFS 免费额度只有 1 GB，20 GB 根本传不上去
- 底模和 LoRA 的再分发许可也不一定允许

所以最后是「**代码 + 下载脚本**」：

- 仓库里只有代码、启动脚本和一份 `setup.ps1`
- 首次运行自动下载 Node、llama.cpp、ComfyUI 便携版和三个模型（约 18 GB）
- 自带一个测试 LoRA 和它的角色提示词，装完就能试

`setup.ps1` 也被现实教育了几轮：

1. **PowerShell 5.1 的编码坑**：默认按 ANSI 读无 BOM 的 UTF-8，中文把 JSON 引号吃掉，`ConvertFrom-Json` 直接报 `ArgumentException`。改成显式 `-Encoding UTF8`。
2. **TLS 坑**：PS 5.1 默认用 TLS 1.0/1.1，GitHub API 只收 1.2+，报「基础连接已经关闭」。开头强制 `Tls12`，并优先用 `curl.exe` 查 API。
3. **ComfyUI 便携包多一层目录**：7z 里是 `ComfyUI_windows_portable\ComfyUI\main.py`，脚本按固定路径找不到就误报「解压不完整」，还把解压目录删了。现在会递归找「同时含 `ComfyUI\main.py` 和 `python_embeded\python.exe`」的那层，找不到才报错，而且**失败时保留文件**。
4. **重复下载**：改成幂等——每一步先检查，装好就跳过；安装包校验通过才删；支持 `.part` 断点续传。

> 顺带一提：国内直连 GitHub 下 2 GB 的 ComfyUI 常常只有几十 KB/s，实测还是开代理或者手机热点最快。试过镜像站，节点不稳反而更容易断，最后老老实实写进 README 提醒。

## 实测耗时（RTX 5070 TI laptop 12 GB）

| 场景 | 耗时 |
|---|---|
| 512×512，8 步 | 23~37 秒 |
| 768×512 + 高清修复 | 40 秒 |
| 1080p + 高清修复 + LoRA | 65~80 秒 |
| 翻译一句（8B） | 3~10 秒 |
| ComfyUI 冷启动 | 40~60 秒 |
| 空闲关闭后下次生图 | 多等一次冷启动（默认 120 秒空闲才关） |

## 现在

它能做的事：

- 中文 → Danbooru 标签（离线、带缓存）
- 两个底模（WAI / NoobAI），各自配好采样器和负面提示词
- 高清修复（像素域两段式：4x 放大 → lanczos 缩放 → VAE 重绘）
- LoRA 安装/加载/删除，角色提示词绑定
- 生成结果点开预览、服务端自动清理

代码和 release 都在这里，感兴趣可以拿去改：

- <https://github.com/AyachiNeneCiallo/image-studio>

最后一句感想：把玩具做成能发给别人用的东西，工作量有一半花在「别人电脑上会不会翻车」上
![产物](/gallery/05-image-4.png)