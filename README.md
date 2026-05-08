<div align="center">
  <img src="./public/favicon.svg" alt="GPT Image Playground" width="120" />
  <h1>GPT Image Playground</h1>
  <p>基于 Next.js 的 GPT Image 生成与编辑工作台</p>
  <p>支持 OpenAI 兼容接口、图片生成、图片编辑、历史详情、成本估算、人民币换算与本站额度价值对比。</p>
  <p>
    <img src="https://img.shields.io/badge/Next.js-16-111827?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
    <img src="https://img.shields.io/badge/React-19-149ECA?style=for-the-badge&logo=react&logoColor=white" alt="React" />
    <img src="https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  </p>
  <p>
    <img src="https://img.shields.io/badge/OpenAI-Compatible-111827?style=flat-square" alt="OpenAI Compatible" />
    <img src="https://img.shields.io/badge/Default_Model-gpt--image--2-18A978?style=flat-square" alt="Default Model gpt-image-2" />
    <img src="https://img.shields.io/badge/Base_URL-configurable-1769E0?style=flat-square" alt="Configurable Base URL" />
    <img src="https://img.shields.io/badge/API_Key-localStorage-DF8D00?style=flat-square" alt="API Key localStorage" />
  </p>
</div>

## 项目简介

GPT Image Playground 是一个面向 `gpt-image-2` 的单页图片生成与编辑工作台。默认模型为 `gpt-image-2`，API Key 和 Base URL 可直接在首页顶部填写。

API Key 和 Base URL 只会保存在当前浏览器的 `localStorage` 中，不会做服务器持久化存储。发起生成或编辑时，浏览器会把本地配置发送给本应用后端接口，用于请求 OpenAI 兼容 API。

## 界面预览

### 首页 · 暗色主题

<p align="center">
  <img src="./readme-images/home-dark.png" alt="Home page dark theme" width="900" />
</p>

### 首页 · 浅色主题

<p align="center">
  <img src="./readme-images/home-light.png" alt="Home page light theme" width="900" />
</p>

### 历史详情

<p align="center">
  <img src="./readme-images/history-detail.png" alt="History detail page" width="900" />
</p>

## 功能特性

- 图片生成：输入提示词生成图片，支持多图批量输出；如果接口返回数量少于所选数量，会自动补请求缺少的图片。
- 图片编辑：上传或粘贴参考图，使用提示词进行编辑。
- 蒙版工具：可在页面内绘制蒙版，也可以上传 PNG 蒙版。
- 尺寸选择：默认 `1:1`，支持 `16:9`、`9:16` 和自定义尺寸。
- 构图约束：请求会按所选尺寸自动补充画布方向约束，降低 16:9 被模型改写成手机竖屏、9:16 被改写成横图的概率。
- 专用模型：前端固定使用 `gpt-image-2`，不需要用户选择模型。
- 首页 API 配置：可在首页顶部填写 API Key 和 Base URL，自动保存到当前浏览器 localStorage，并提供获取 Key 的快捷入口。
- 可配置 Base URL：页面不预设默认值；留空时使用服务端环境变量配置（若有）。
- 主题与语言：首页右上角支持中文 / English 与浅色 / 深色切换。
- 实时计时：点击生成后会显示本次请求已耗时。
- 图片预览与下载：生成结果、历史列表和详情页均支持下载图片，多图结果支持左右切换和网格查看。
- 历史记录：历史元数据保存在浏览器 localStorage，生成后的图片会缓存到浏览器 IndexedDB，并可按配置保存到服务端文件系统。
- 修订提示词：默认显示用户输入的原始提示词；如果接口返回 `revised_prompt`，当前结果和历史详情可切换查看模型实际采用的修订提示词，并会按当前界面语言向上游传递语言偏好。
- 线上过期提醒：根据生成时间计算线上服务器图片的 3 天清理时间，提醒用户及时下载。
- 历史详情页：查看图片、提示词、请求参数、过期提醒、耗时、尺寸、格式、成本和额度对比。
- 成本估算：按 API usage 和模型 token 单价估算美元成本，并显示人民币换算。
- 额度价值对比：按本站 `¥1 = 20 张图` 计算单图 `¥0.05`，对比官方估算成本，展示大约节省金额和划算倍数。

## 历史与成本

历史列表会记录每次生成或编辑的关键信息，包括生成时间、模型、尺寸、质量、背景、审核级别、输出格式、耗时、图片数量、原始提示词、修订提示词和成本明细。

点击历史列表中的某张缩略图会在中间预览区直接切换到对应图片；多图结果也支持在预览区通过左右箭头、底部缩略图和网格按钮切换。

线上服务器图片只会保留 3 天，超过时间会自动清理。页面会根据历史记录里的生成时间实时计算线上过期时间，并在历史列表和详情页提醒还剩多久清理。重要图片请在过期前下载保存。

成本展示包含三类信息：

- 官方估算成本：根据接口返回的 usage 与模型单价计算。
- 人民币换算：使用固定估算汇率展示 `USD / RMB`。
- 本站额度价：按 `¥1 = 20 张图` 计算，帮助用户直观看到额度价值。

> 说明：官方价格常量写在 `src/lib/cost-utils.ts` 中，不会实时抓取官方价格；如官方定价变化，需要同步更新该文件。

## 蒙版编辑

编辑模式支持直接在图片上涂抹生成蒙版，适合指定局部修改区域。

## 存储说明

项目支持两种图片存储模式，通过 `NEXT_PUBLIC_IMAGE_STORAGE_MODE` 控制：

- `fs`：默认模式，图片保存到服务端 `generated-images` 目录。
- `indexeddb`：图片保存到当前浏览器 IndexedDB，适合 Vercel 等无持久文件系统的部署环境。

历史元数据始终保存在浏览器 `localStorage`，生成后的图片会尽量缓存到浏览器 IndexedDB，后续查看历史优先读取本地缓存。清空浏览器数据、切换浏览器或切换设备后，历史记录不会同步。

需要注意：本地缓存只是当前浏览器里的便捷缓存，不是持久备份。如果浏览器缓存或 IndexedDB 被清理，并且线上服务器图片已经超过 3 天被自动清理，历史里只剩元数据，图片本身将无法恢复。

## Docker 一键部署

已发布 Docker Hub 双架构镜像，支持 `linux/amd64` 和 `linux/arm64`：

```text
tannic666/gpt-image-2-webui:latest
```

推荐使用 Docker Compose 部署，默认会直接拉取 Docker Hub 镜像：

```bash
docker compose up -d
```

启动后访问：

```text
http://服务器IP:3000
```

默认会把容器内的图片目录挂载到宿主机：

```text
./generated-images:/app/generated-images
```

这样在默认 `fs` 存储模式下，生成图片会持久保存在宿主机的 `generated-images` 目录。

### 生成图片自动清理

Docker 镜像已内置生成图片自动清理。使用 Docker Compose 或 `docker run` 启动容器后，容器会默认开启一个后台清理循环：启动时先检测一次，之后每 24 小时检测一次，保留最近 3 天生成的图片。由于默认 Compose 会把 `./generated-images` 挂载到 `/app/generated-images`，清理的是宿主机持久化目录里的过期图片。

可用环境变量调整 Docker 内置清理：

```dotenv
GENERATED_IMAGE_CLEANUP_ENABLED=true
GENERATED_IMAGE_RETENTION_DAYS=3
GENERATED_IMAGE_CLEANUP_INTERVAL_HOURS=24
GENERATED_IMAGE_CLEANUP_RUN_ON_START=true
GENERATED_IMAGE_CLEANUP_DRY_RUN=false
GENERATED_IMAGE_CLEANUP_LOG_FILE=/app/logs/cleanup-generated-images.log
```

如果不希望容器自动清理，把 `GENERATED_IMAGE_CLEANUP_ENABLED=false` 写入 `.env` 后重启容器即可。

仓库提供了清理脚本 `scripts/cleanup-generated-images.sh`，默认清理脚本所在项目目录下的 `generated-images`；按本文路径部署时就是 `/opt/gpt-image-2-webui/generated-images`。日志默认写入 `/var/log/gpt-image-2-webui/cleanup-generated-images.log`。脚本会根据文件名里的生成时间戳判断过期时间，例如 `1777474614523-0.jpeg`；`.png`、`.jpg`、`.jpeg`、`.webp` 之外或命名不匹配的文件会跳过并写入日志。

在服务器上先给脚本执行权限：

```bash
chmod +x /opt/gpt-image-2-webui/scripts/cleanup-generated-images.sh
```

直接运行脚本会进入中文交互菜单，可以试运行、立即清理、添加/查看/删除 cron 定时任务：

```bash
/opt/gpt-image-2-webui/scripts/cleanup-generated-images.sh
```

如果需要在 cron 或 systemd timer 中非交互执行，请加 `--run`，例如每天凌晨 3 点清理一次：

```cron
0 3 * * * /opt/gpt-image-2-webui/scripts/cleanup-generated-images.sh --run
```

如果项目目录不是 `/opt/gpt-image-2-webui`，可以显式指定目录、保留天数和日志：

```cron
0 3 * * * /your/project/scripts/cleanup-generated-images.sh --run --image-dir /your/project/generated-images --retention-days 3 --log-file /var/log/gpt-image-2-webui/cleanup-generated-images.log
```

更详细的说明见 `scripts/cleanup-generated-images-使用说明.md`。

### Docker 环境变量

可以在项目根目录创建 `.env` 文件：

```dotenv
PORT=3000
OPENAI_API_KEY=your_api_key_here
OPENAI_API_BASE_URL=
OPENAI_IMAGE_TIMEOUT_MS=1200000
NEXT_PUBLIC_IMAGE_STORAGE_MODE=fs
APP_PASSWORD=
GENERATED_IMAGE_CLEANUP_ENABLED=true
GENERATED_IMAGE_RETENTION_DAYS=3
GENERATED_IMAGE_CLEANUP_INTERVAL_HOURS=24
GENERATED_IMAGE_CLEANUP_RUN_ON_START=true
```

然后启动：

```bash
docker compose up -d
```

如果你希望用户在首页自行填写 API Key 或 Base URL，对应的环境变量可以留空。

也可以不克隆源码，直接使用 `docker run`：

```bash
docker run -d --name gpt-image-2-webui --restart unless-stopped -p 3000:3000 -e NEXT_PUBLIC_IMAGE_STORAGE_MODE=fs -v ${PWD}/generated-images:/app/generated-images tannic666/gpt-image-2-webui:latest
```

常用 Docker 命令：

```bash
# 查看日志
docker compose logs -f

# 重启
docker compose restart

# 停止
docker compose down

# 更新 Docker Hub 镜像
docker compose pull
docker compose up -d

# 如需从源码本地构建
docker build -t gpt-image-2-webui:local .

# 如需构建 IndexedDB 存储模式镜像
docker build --build-arg NEXT_PUBLIC_IMAGE_STORAGE_MODE=indexeddb -t gpt-image-2-webui:indexeddb .
```

## 本地开发

### 环境要求

- Node.js 20 或更高版本
- npm

### 安装依赖

```bash
npm install
```

### 启动开发服务

```bash
npm run dev
```

启动后访问：

```text
http://localhost:3000
```

## API 配置

你可以直接在首页顶部填写 API Key 和 Base URL，也可以点击“获取 Key”在新标签页打开当前 Base URL 同域名下的 `/console/token` 创建令牌。例如 Base URL 是 `https://api.example.com/v1` 时，获取 Key 会打开 `https://api.example.com/console/token`。Base URL 页面不预设默认值；也可以使用环境变量配置服务端默认 API Key 或 Base URL。

### `.env.local` 示例

```dotenv
OPENAI_API_KEY=your_api_key_here
OPENAI_API_BASE_URL=
OPENAI_IMAGE_TIMEOUT_MS=1200000
```

如果请求没有显式传入 Base URL，服务端会使用 `OPENAI_API_BASE_URL`（若已配置）。

## 可选配置

### 图片请求超时

服务端请求 OpenAI 兼容接口的超时默认是 `1200000ms`（20 分钟），适合 `gpt-image-2` 这种生成时间较长的图片请求。前端没有额外设置 AbortController 超时，会持续等待 `/api/images` 返回。

如需调整：

```dotenv
OPENAI_IMAGE_TIMEOUT_MS=1200000
```

### IndexedDB 模式

适合部署到 Vercel 等服务端文件系统不可持久保存的环境：

```dotenv
NEXT_PUBLIC_IMAGE_STORAGE_MODE=indexeddb
```

未设置时，本地默认使用 `fs`。如果部署环境检测到 Vercel，项目会默认使用 `indexeddb`。

Docker Hub 镜像 `tannic666/gpt-image-2-webui:latest` 默认按 `fs` 模式构建；如果需要 Docker 环境使用 `indexeddb`，请按上面的源码构建命令重新构建镜像。

### 访问密码

可以配置一个简单的应用密码：

```dotenv
APP_PASSWORD=your_password_here
```

启用后，前端会要求输入密码再发起生成请求。

## 常用命令

```bash
# 开发
npm run dev

# 代码检查
npm run lint

# 生产构建
npm run build

# 启动生产服务
npm run start
```

## 目录结构

```text
src/
  app/                 Next.js App Router 页面与 API
  components/          页面组件与 UI 组件
  lib/                 本地配置、i18n、成本、尺寸、IndexedDB 等工具
public/                静态资源
readme-images/         README 截图（首页与历史详情）
scripts/               服务器维护脚本，例如生成图片自动清理
generated-images/      fs 模式下的图片输出目录
```

## 注意事项

- API Key 请妥善保存，不要提交到仓库。
- 首页 API Key 保存的是浏览器本地配置，不是账号级云端配置。
- IndexedDB 缓存只在当前浏览器中可用。
- 线上服务器图片只保留 3 天，重要图片请及时下载到本地电脑或其他持久存储位置。
- `generated-images` 目录适合本地或有持久磁盘的服务器，不适合无状态 Serverless 持久存储。
- 官方成本只是估算值，实际账单以接口服务商结算为准。

## License

MIT
