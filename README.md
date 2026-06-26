# AI Camera · 实时骨骼检测与姿势引导

基于摄像头的实时人体骨骼检测 Web 应用：摄像头画面上叠加 17 点骨骼，与目标姿势进行相似度匹配，并通过场景识别自动推荐合适的拍照姿势。

> 暗色主题，移动端优先的竖屏布局，适合摄影姿势学习 / 跟拍场景。

## ✨ 功能特性

- **实时骨骼检测**：基于 TensorFlow.js MoveNet（SinglePose Lightning，17 个关键点）实时绘制用户骨骼
- **姿势相似度匹配**：以关键点欧氏距离 + 躯干归一化计算相似度，> 80 分时画面出现绿色高亮边框
- **目标姿势引导**：半透明白色「幽灵骨骼」作为对照目标，可一键切换
- **场景识别**：每 5 秒抓取画面调用 Qwen API 识别当前场景（海边 / 街道 / 公园 / 咖啡厅 / 山景 / 室内），并从本地姿势库推荐 3 个姿势
- **性能监控**：右上角实时 FPS 显示，底部相似度进度条

## 🛠 技术栈

| 分类 | 选型 |
| --- | --- |
| 框架 | Next.js 14（App Router） |
| 语言 | TypeScript |
| 样式 | Tailwind CSS |
| ML 模型 | TensorFlow.js · MoveNet |
| 场景识别 | Qwen API（`qwen3.5-plus`）via REST |
| 图标 | lucide-react |

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制示例文件并填入你自己的 Qwen API Key：

```bash
cp .env.example .env
```

```env
NEXT_PUBLIC_QWEN_API_KEY=your-api-key-here
NEXT_PUBLIC_QWEN_MODEL=qwen3.5-plus
NEXT_PUBLIC_QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

API Key 可在 [阿里云百炼 / DashScope](https://dashscope.aliyuncs.com/) 控制台获取。

### 3. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)，浏览器会请求摄像头权限（移动端建议使用后置摄像头）。

## 📜 可用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | 运行 ESLint |

## 📁 项目结构

```
ai_camera/
├── app/
│   ├── layout.tsx        # 根布局
│   ├── page.tsx          # 主页面（摄像头 + 骨骼 + UI）
│   └── globals.css       # 全局样式 / Tailwind
├── components/
│   ├── CameraView.tsx        # 摄像头画面层
│   ├── SkeletonOverlay.tsx   # 骨骼叠加绘制（用户 + 目标）
│   ├── PoseGuide.tsx         # 姿势引导主容器
│   └── PoseSelector.tsx      # 底部姿势切换按钮
├── lib/
│   ├── movenet.ts            # MoveNet 模型加载与推理
│   ├── poseData.ts           # 目标姿势数据
│   ├── similarity.ts         # 相似度计算
│   ├── sceneRecognition.ts   # Qwen 场景识别调用
│   └── poseLibrary.json      # 本地姿势库（按场景）
├── public/
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── SPEC.md
```

## 🎯 核心实现要点

- **骨骼连接**：基于 COCO 17 关键点格式，按预定义连接对绘制线段与关节点
- **相似度算法**：对每个关键点计算用户/目标间的欧氏距离，以左肩到右髋的躯干距离做尺度归一化，取平均后映射为 `100 - avgDistance * 100` 并 clamp 到 0–100
- **场景识别流程**：抓帧 → base64 JPEG → Qwen 场景分类 prompt → 解析场景 → 查询本地姿势库 → 展示 Top 3 推荐姿势

详细规格见 [SPEC.md](./SPEC.md)。

## 🔒 安全说明

- `.env` 已被 `.gitignore` 忽略，**切勿提交真实 API Key**。
- 如不慎泄露 Key，请立即到 DashScope 控制台吊销并重新生成。

## 📄 License

MIT
