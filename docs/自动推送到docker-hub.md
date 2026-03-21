# 自动推送到 Docker Hub 配置教程

本文档说明如何为当前仓库配置 GitHub Actions，使其在发布 GitHub Release 后自动构建并推送 Docker 镜像到 Docker Hub。

对应的自动化 workflow 是：

- [`.github/workflows/publish-release-images.yml`](../.github/workflows/publish-release-images.yml)

它会在以下场景触发：

- 发布一个 GitHub Release 时立即触发
- 在 GitHub Actions 页面手动触发
- 每 12 小时自动补偿检查一次

## 一、先理解这套流程会用到什么

要让自动推送成功，GitHub Actions 需要知道两类信息：

1. 登录 Docker Hub 的凭证
2. 要推送到哪个 Docker Hub 镜像仓库

因此你至少需要在 GitHub 仓库里配置：

- Repository Secret：`DOCKERHUB_USERNAME`
- Repository Secret：`DOCKERHUB_TOKEN`
- Repository Variable：`DOCKERHUB_IMAGE`

最推荐的最小配置方式是：

- `DOCKERHUB_USERNAME=你的 Docker Hub 用户名`
- `DOCKERHUB_TOKEN=你的 Docker Hub Access Token`
- `DOCKERHUB_IMAGE=你的用户名/metamcp`

例如：

```text
DOCKERHUB_USERNAME=huangwb8
DOCKERHUB_IMAGE=huangwb8/metamcp
```

注意：

- `DOCKERHUB_IMAGE` 只写镜像仓库名，不要带 `:latest`
- 不要写成 `docker.io/huangwb8/metamcp`
- 正确写法是 `用户名/仓库名`

## 二、Docker Hub 仓库要不要先手动创建

结论：

- 技术上：通常不是必须，首次 `docker push` 时 Docker Hub 往往会自动创建仓库
- 实际上：建议先手动创建，更稳、更直观，也更方便确认仓库名和可见性

推荐做法是先手动建一个仓库，例如：

- 仓库名：`metamcp`
- 最终镜像名：`huangwb8/metamcp`

如果你不想先建仓库，也可以直接继续下面步骤，等 GitHub Actions 首次推送时自动创建。

## 三、Step-by-step 配置教程

### Step 1：登录 Docker Hub

打开 Docker Hub 并登录你的账号：

- https://hub.docker.com/

### Step 2：创建 Docker Hub Access Token

在 Docker Hub 中：

1. 点击右上角头像
2. 进入 `Account settings`
3. 找到 `Personal access tokens`
4. 点击 `Generate new token`
5. 名称建议填写：`github-actions-metamcp`
6. 权限选择：`Read & Write`
7. 创建后立刻复制保存

后面 GitHub 里的 `DOCKERHUB_TOKEN` 就填这个值。

### Step 3：可选，先手动创建 Docker Hub 仓库

如果你想走最稳妥路线，可以先建仓库：

1. 在 Docker Hub 首页点击 `Create repository`
2. 仓库名填写：`metamcp`
3. Visibility 选择：
   - `Public`：任何人都能拉取
   - `Private`：只有你或授权成员能拉取
4. 点击创建

创建后，你的镜像目标一般会是：

```text
你的用户名/metamcp
```

例如：

```text
huangwb8/metamcp
```

### Step 4：进入 GitHub 仓库设置页面

打开当前 GitHub 仓库页面后：

1. 点击 `Settings`
2. 在左侧菜单点击 `Secrets and variables`
3. 点击 `Actions`

后面会分别配置 `Secrets` 和 `Variables`。

### Step 5：添加 GitHub Secret `DOCKERHUB_USERNAME`

在 `Secrets` 标签中：

1. 点击 `New repository secret`
2. Name 填：`DOCKERHUB_USERNAME`
3. Secret 填：你的 Docker Hub 用户名
4. 点击保存

例如：

```text
Name: DOCKERHUB_USERNAME
Secret: huangwb8
```

### Step 6：添加 GitHub Secret `DOCKERHUB_TOKEN`

继续在 `Secrets` 标签中：

1. 点击 `New repository secret`
2. Name 填：`DOCKERHUB_TOKEN`
3. Secret 填：你刚刚在 Docker Hub 创建的 Access Token
4. 点击保存

例如：

```text
Name: DOCKERHUB_TOKEN
Secret: dckr_pat_xxxxxxxxxxxxx
```

### Step 7：添加 GitHub Variable `DOCKERHUB_IMAGE`

切换到 `Variables` 标签：

1. 点击 `New repository variable`
2. Name 填：`DOCKERHUB_IMAGE`
3. Value 填：`你的用户名/metamcp`
4. 点击保存

例如：

```text
Name: DOCKERHUB_IMAGE
Value: huangwb8/metamcp
```

注意：

- 不要写成 `huangwb8/metamcp:latest`
- 不要写成 `docker.io/huangwb8/metamcp`
- 不要带 digest，例如 `@sha256:...`

### Step 8：检查配置是否齐全

此时 GitHub 仓库中应该至少有这些项：

Secrets：

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

Variables：

- `DOCKERHUB_IMAGE`

如果你不用 `DOCKERHUB_IMAGE`，也可以改用下面这组组合：

- `DOCKERHUB_NAMESPACE`
- `DOCKERHUB_REPOSITORY`（可选）

但对于当前仓库，最推荐还是直接用一个 `DOCKERHUB_IMAGE`，更简单，不容易配错。

### Step 9：手动触发 workflow 验证一次

打开 GitHub 仓库的 `Actions` 页面：

1. 找到 workflow：`Publish release Docker image to Docker Hub`
2. 点击进入
3. 点击右上角 `Run workflow`
4. 选择默认分支
5. 点击运行

这个动作的作用是：

- 如果仓库已经有已发布的 GitHub Release，它会拿最新 release 去尝试推镜像
- 如果仓库还没有任何已发布 Release，它会直接跳过，不会推镜像

## 四、如果仓库还没有 Release，怎么做

如果你还没有 GitHub Release，需要先发布一个。

### Step 10：创建一个 GitHub Release

在 GitHub 仓库里：

1. 点击 `Releases`
2. 点击 `Draft a new release`
3. Tag 建议使用语义化版本，例如：
   - `v1.0.1`
   - `v1.1.0`
4. 填写标题和说明
5. 点击 `Publish release`

发布后，自动发布 workflow 会立即触发。

## 五、推送成功后会产生哪些镜像标签

如果你发布的是：

```text
v1.2.3
```

稳定版会推送这些标签：

- `v1.2.3`
- `1.2.3`
- `1.2`
- `1`
- `latest`

也就是说，最终你在 Docker Hub 上会看到类似：

```text
huangwb8/metamcp:v1.2.3
huangwb8/metamcp:1.2.3
huangwb8/metamcp:1.2
huangwb8/metamcp:1
huangwb8/metamcp:latest
```

如果是预发布版本，workflow 只会推送 release 对应标签，不会推进 `latest`。

## 六、本地 docker-compose 如何切换到 Docker Hub 镜像

当 Docker Hub 镜像已经成功发布后，本地部署可以直接使用：

1. 复制环境文件：

```bash
cp example.env .env
```

2. 在 `.env` 中加入：

```bash
METAMCP_IMAGE=docker.io/你的用户名/metamcp:latest
```

例如：

```bash
METAMCP_IMAGE=docker.io/huangwb8/metamcp:latest
```

3. 启动：

```bash
docker compose up -d
```

当前仓库的 [`docker-compose.yml`](../docker-compose.yml) 已支持 `METAMCP_IMAGE` 覆盖，因此不需要直接修改 compose 文件。

## 七、最常见的配置错误

### 1. `DOCKERHUB_IMAGE` 填错格式

错误示例：

```text
docker.io/huangwb8/metamcp
huangwb8/metamcp:latest
huangwb8/metamcp@sha256:xxxx
```

正确示例：

```text
huangwb8/metamcp
```

### 2. `DOCKERHUB_TOKEN` 不是 Docker Hub token

`DOCKERHUB_TOKEN` 必须来自 Docker Hub 的 Access Token，不是：

- GitHub token
- GitHub PAT
- Docker 登录密码

### 3. Docker Hub token 权限不够

建议使用具备 `Read & Write` 权限的 token。

### 4. 仓库里还没有已发布的 GitHub Release

如果没有 release，手动运行 workflow 时会直接跳过，这是正常行为。

### 5. 发布的是预发布版本，却期待 `latest` 被更新

当前 workflow 设计是：

- 稳定版更新 `latest`
- 预发布不更新 `latest`

这是为了避免 beta / rc 镜像覆盖正式版。

## 八、推荐的最简配置方案

如果你只想最快配通，直接按下面这一组来：

Secrets：

- `DOCKERHUB_USERNAME=你的 Docker Hub 用户名`
- `DOCKERHUB_TOKEN=你的 Docker Hub Access Token`

Variables：

- `DOCKERHUB_IMAGE=你的用户名/metamcp`

例如：

```text
DOCKERHUB_USERNAME=huangwb8
DOCKERHUB_IMAGE=huangwb8/metamcp
```

然后：

1. 发布一个 GitHub Release
2. 等待 `Publish release Docker image to Docker Hub` workflow 完成
3. 去 Docker Hub 查看镜像是否已出现

## 九、建议的上线检查清单

正式启用前，建议按这个顺序检查一遍：

1. Docker Hub token 已创建，且仍可用
2. GitHub Secrets `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` 已配置
3. GitHub Variable `DOCKERHUB_IMAGE` 已配置
4. `DOCKERHUB_IMAGE` 不带 `:tag`
5. 仓库已存在一个已发布的 GitHub Release
6. 手动运行一次 workflow 验证
7. 在 Docker Hub 页面确认对应 tag 已出现
8. 本地使用 `METAMCP_IMAGE` 做一次 `docker compose up -d` 验证

## 十、补充说明

当前仓库已经支持：

- GitHub Release 驱动 Docker Hub 发布
- 每 12 小时自动补偿检查
- 缺失标签探测，避免重复构建
- 多架构镜像推送：`linux/amd64` 和 `linux/arm64`
- 通过 `METAMCP_IMAGE` 在本地 compose 中切换镜像源

如果后续你调整了 Docker Hub 仓库名，只需要同步更新 GitHub 中的 `DOCKERHUB_IMAGE` 即可。
