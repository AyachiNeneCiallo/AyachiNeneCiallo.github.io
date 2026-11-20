---
title: "3.5 寸 USB 小屏改造记：让宁宁住进副屏监视系统占用"
description: "从 Python 监视器到官方 Cubism Framework 的 C++ 单 exe：手写渲染器的坑、参数实测的意外发现、以及把两块东西缝进一个 640×480 窗口的全过程"
pubDate: 2026-11-20
tags: ["Live2D","Cubism","C++","折腾记录","硬件"]
cover: "/images/nene-mini-screen/01-main.png"
---
做了一块3.5寸的USB桌面副屏拓展坞，突然有一个应用商店想法。\
于是就变成了这个：

![最终效果](/images/nene-mini-screen/01-main.png)

左边 CPU / GPU / 显存，中间宁宁，右边温度 / 内存 / 网络。640×480。

## 先说硬件

关于这块屏的几个事实，后面所有的排版决策都是被它逼出来的：

| 项目 | 值 |
|---|---|
| 物理分辨率 | 320×240 |
| 驱动设置 | 640×480（像素翻倍显示） |
| 在系统里 | `\\.\DISPLAY30`，坐标 (2560, 1115) |
| 尺寸 | 3.5 寸 |

分辨率只有 640×480，意味着**每一像素都很贵**。想同时塞下数据和人物，只能切成三栏：左右各 160 px 给数据，中间 320 px 给人物。

## 第一版：一个能用的 Python 监视器

最早是很朴素的方案：Python + tkinter，全屏白底，左右两栏画文字和进度条。

数据采集倒不难：

| 数据 | 来源 |
|---|---|
| CPU 占用 | `psutil` / PDH |
| GPU 3D、CUDA | PDH `\GPU Engine(*)\Utilization Percentage` |
| 显存、GPU 温度 | NVML（`pynvml`） |
| 内存 | `psutil.virtual_memory()` |
| 网络上下行 | `psutil.net_io_counters()` |

这里踩过一个印象深刻的坑：**GPU 占用必须按引擎类型分别取**。

`\GPU Engine(*)\Utilization Percentage` 在系统里有 600 多个实例（每个进程 × 每种引擎一个），如果直接求和或者取平均，得到的是完全没意义的数字。正确的做法是只看 `engtype_3D` 和 `engtype_Compute`，各自取**最大值**：

```python
for inst in instances:
    if 'engtype_3D' in inst:
        gpu3d = max(gpu3d, value)
    elif 'engtype_Compute' in inst:
        gpu_cuda = max(gpu_cuda, value)
```

另外 PDH 返回的是无符号 DWORD，Python 里读出来会变成负数，要 `& 0xFFFFFFFF` 一下。

用了几天我不想再单独开live2dviewex了，又是就想内置live2d加载器。

## 先走了最远的那条路

第一个念头很朴素：既然要显示 Live2D，那就自己写个 Live2D 渲染器吧。

用 C# + OpenTK 起了个 WinForms 工程，直接 P/Invoke 官方 Core 库 `Live2DCubismCore.dll`：

```csharp
[DllImport("Live2DCubismCore.dll")]
private static extern IntPtr csmReviveMocInPlace(IntPtr moc, uint size);
```

两天之后画面是这样的：

> 模型出来了，但是：

- 整体半透明，背景能透过来
- 嘴渲染成了两个重叠的
- 脸旁边有一圈奇怪的虚影
- 裙摆下面有一块浅色方块

每一个都修了，每修一个就冒出一个新的。最崩溃的一次是**长发整段消失**——查了两个小时才发现，这个模型的长发用了**一个尺寸几乎为零的「占位遮罩」**（bbox 只有 0.02×0.03），启用遮罩等于把头发裁没了。

问题不在于我的代码写错了，而在于：**我在重新实现一个已经存在、且极其复杂的规范**。

Live2D 的渲染规范里有一堆隐式约定：遮罩的叠加顺序、遮罩为 0 时的语义、乘算颜色与屏幕颜色的混合顺序、预乘 alpha、每种 blend mode 的具体公式……每一条都可以查，但拼起来就是两周。

## 转折：用官方 Framework

后来想通了——官方给了完整的 Native Framework，为什么不用？

```
CubismSdkForNative-5-r.5
├── Core/          # 只有运行时，P/Invoke 用的
└── Framework/     # 完整实现：模型、物理、动作、渲染器
```

改用 **Win32 + WGL + `CubismRenderer_OpenGLES2`** 之后，之前那些问题**一次性全消失了**：

- 遮罩：官方用离屏 FBO + 正确的 mask 语义
- 混合模式：官方逐图层处理
- 物理：`physics3.json` 直接喂给 `CubismPhysics`
- 动作、表情：`CubismMotion` / `CubismExpressionMotion`

自己只需要写三件事：**创建窗口、加载模型、每帧调 `DrawModel()`**。

那两周的教训写在这里：

> 如果一个东西的规范光是「约定」就有几十条，别自己实现。找官方渲染器。

## 参数实测

官方渲染器解决的是「画得对」，下一个问题是「动得对」。

我的要求很具体：**鼠标移动时她转头看我，但身体不要整体晃，要像侧身那样**。

听起来简单，实际试了七八轮都不对。最后一次我决定不再猜，直接把 229 个参数**逐个扫描**：

```powershell
# 对每个参数取 min/2、max/2，用 --debug-param 固定值后截图
NeneCubism.exe --snapshot p.png --frames 40 --exit --debug-param ParamBodyAngleZ=8
```

然后用像素分析测「头顶 / 脸 / 领结 / 胸 / 腰 / 裙摆 / 脚」七个高度带的位移。结论非常反直觉：

| 参数 | 直觉 | 实测 |
|---|---|---|
| `ParamBodyAngleX` | 身体左右转 | **分层水平剪切**：外套横移 ±30px、裙子横移 ±39px，两者错位，看起来像「整体歪」 |
| `ParamBodyAngleY` | 前倾弯腰 | **整体上下平移**，不是弯腰 |
| `ParamBodyAngleZ` | 身体侧倾 | ✅ **唯一真正以腰为支点的旋转** |
| `ParamAngleX` | 头部左右转 | ✅ 正常，上限 ±30 |
| `ParamAngleY` | 抬头低头 | ✅ 正常，以脖子为支点 |

`ParamBodyAngleZ` 的证据很干脆——沿身体高度测量位移：

```
头顶 +47px
脸   +42px
领结 +28px
胸   +19px
腰   +7px
裙摆 -3px
大腿 -10px
```

位移随高度递增、在腰线处过零——这是绕腰部旋转，不是平移。如果是平移，各高度带应该等量位移。

于是最终映射是：

```cpp
ParamAngleX     = 30 * eyeX;   // 头部转身（主）
ParamAngleY     = 10 * eyeY;   // 抬头/低头
ParamAngleZ     = 0;           // 头不歪
ParamBodyAngleX = 3  * eyeX;   // 肩线极轻跟随（再大就剪切）
ParamBodyAngleY = 0;           // 禁用（整体平移）
ParamBodyAngleZ = 0;           // 禁用（整体侧倾）
ParamEyeBallX/Y = 0.25 * eye;  // 眼球只跟一点点
```

顺便说个反例：`ParamBodyAngleZ` 也给到 10 度试过，效果是「整个人歪着倒」，用户原话是"还是斜得很严重"。有些参数作者留了范围，但不代表适合拿来做这个。

## 从一个人在动，到一块屏在干活

形象调好之后，就该把数据缝进来了。

原来的 Python 面板是独立窗口（全屏 640×480），Live2D 是另一个窗口浮在上面。两个进程、两个窗口、层级和焦点全是麻烦。索性**用 C++ 重写一遍**，做成单进程单窗口：

```
glViewport(160, 0, 320, 480);   // 中间给 Live2D
// 左右 160px 用 GDI+ 画到 DIB，再上传成纹理铺上去
```

数据采集全部重写（顺手甩掉了 Python 解释器）：

| 数据 | C++ 实现 |
|---|---|
| CPU | `GetSystemTimes` 差分 |
| GPU 3D / CUDA | PDH `\GPU Engine(*)`，`engtype_3D` / `engtype_Cuda` 各取最大 |
| 显存 / 温度 | NVML（`nvmlInit_v2` + `nvmlDeviceGetMemoryInfo`） |
| 内存 | `GlobalMemoryStatusEx` |
| 网络 | `GetIfTable2` + QPC 差分 |

和 Python 版同时刻对拍，数字完全一致：

```
CPU     10.5% / 10.5%
GPU 3D   8%   / 8%
CUDA     0%   / 0%
显存    18.1% / 18.1%（2.2G）
温度    61℃  / 61℃
内存    48.7% / 48.7%
```

## 一些零碎的细节

**清晰度**。8K 贴图缩小显示时会糊，因为官方 shader 里写死了 `GL_LINEAR_MIPMAP_LINEAR`。改不了 filter，就绕路：各向异性 16x、LOD bias -0.5，再加上 **2× SSAA**（先渲到 1280×960 再缩回 640×480）。同一块区域的梯度能量从 9.40 涨到 10.94。

**托盘**。迷你屏只有 640×480，加按钮要么挡人物要么挤面板，所以控制全放到托盘右键菜单：

```
☐ 隐藏窗口
☑ 锁定模型
☑ 置顶显示
☐ 开机启动
────────
  退出
```

![托盘菜单](/images/nene-mini-screen/03-tray.png)

置顶状态存进配置文件第 4 个字段，重启恢复：

```
0.001503,0.423355,0.276157,0    # cx,cy,hh,topmost
```

**换模型**。这个功能后来证明最容易出问题——不是加载失败，而是**取景参数沿用旧模型的**。宁宁的 canvas 是 2.5×5.0，换成千绘莉（1.0×2.1）之后，画面变成了「只有半张脸」。所以换模型的第一件事是**删掉 `model.cfg`**：

```powershell
Rename-Item 'E:\宁宁迷你屏\model' 'model_backup'
Copy-Item '新模型\*' 'E:\宁宁迷你屏\model\' -Recurse -Force
Remove-Item 'E:\宁宁迷你屏\model.cfg'      # 这步最容易被忘
```

![换成千绘莉](/images/nene-mini-screen/02-chieri.png)

## 发布时遇到的一个怪事

打包成 42 MB 的 zip（8K 贴图占大头），想传 GitHub Release，结果：

```
Post "https://uploads.github.com/.../assets": 
write tcp ...: An existing connection was forcibly closed by the remote host.
```

一直以为是代理限速，测了一下确实是 0.14 MB/s 上传。但缩小到 1 MB 以内能传、3.9 MB 就断——这就不是速度问题了，是**连接存活时间**。

最后绕过去的办法是：大文件走 `git push`（SSH 通道好好的，42 MB 一次过），Release 附件由人在浏览器里手动拖上去。

顺手记两个网络上的坑：

- 这台机器上 `github.com`、`api.github.com` 都能直接解析，**唯独 `uploads.github.com` 解析不了**
- 试过往 hosts 里把它指向 api 的 IP，能连上但返回 `HTTP 400`（虚拟主机不匹配）

## 最终的数字

跑在迷你屏上，实测：

| 指标 | 数值 |
|---|---|
| 工作集内存 | 152 MB |
| CPU（32 核口径） | 0.39% 平均 / 0.85% 峰值 |
| GPU 3D 引擎 | 1.7% |
| 帧率 | 约 60 fps |
| 线程 | 9 |
| 包体积 | 42.4 MB（8K 贴图 42.9 MB，压缩后） |

想在更省的机器上跑，把 8K 贴图降到 2K，包体积能压到 4 MB——代价是近距离看会有点糊，在 320 px 宽的屏上其实看不出来。

## 复盘

如果重来一次，三件事会做得不一样：

1. **先找官方实现，再考虑自己写**。手写 Live2D 渲染器花掉的两周，在我用官方 Framework 之后显得毫无必要。
2. **别信参数名，要测**。`ParamBodyAngleX` 听起来是「身体左右转」，实际是水平剪切；`ParamBodyAngleY` 听起来是弯腰，实际是整体平移。名字是给编辑器看的，行为得自己量。
3. **分辨率决定设计**。640×480 上，160 / 320 / 160 的三栏切分不是审美选择，是被像素逼出来的唯一解——所有字号、进度条高度、留白都是从这个前提反推的。

---

代码在 [GitHub](https://github.com/AyachiNeneCiallo/NeneCubismMiniScreen)，用的是官方 Cubism Native Framework 5-r.5 + Win32/OpenGL。模型版权归原作者，仓库里只有代码，模型需要自己放进去。
