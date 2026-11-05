# 开发与 AI 迭代手册

维护基线：2026-11-05，网站 v1.2.5。本文是定位索引，不代替实时源码、远端分支和接口契约。

## 快速接手

- 仓库：[canmingwei27-star/Amazon-work-web](https://github.com/canmingwei27-star/Amazon-work-web)，发布分支 main。
- Node.js 24，ES Modules；原生 HTTP、原生浏览器 JS/CSS，无第三方运行依赖，无前端编译步骤。
- 仓库根目录直接包含 server.mjs、public、test、Dockerfile。历史 Codex 交付副本位于 outputs/sellfox-dashboard；新机器应以检出的仓库根目录为准，不依赖旧会话路径。
- 先读根目录 AGENTS.md，再按下表定位；不必先通读全部代码或聊天记录。
- 当前没有前后端独立发布或浏览器热更新。小修改也是发布新网站镜像，Docker 复用未变化的层。
- 源码、CI、NAS 是三个不同状态：已提交 → CI 测试并发布成功 → NAS 助手安装并健康运行。报告完成情况必须区分。

本地启动：

```sh
node --env-file-if-exists=.env server.mjs
```

默认端口3000；PORT 可覆盖。DATA_DIR 指向本地测试目录，避免操作生产数据。首次无账号时网页初始化管理员；测试可用虚构 DASHBOARD_USER / DASHBOARD_PASSWORD。不要复制生产密钥到测试环境。

## 修改定位表

| 请求类型 | 优先读取/修改 | 关联验证 |
|---|---|---|
| 颜色、间距、表格样式 | public/style.css | 受影响页面视觉检查 |
| 长表格横向滚动条、工作区表头吸顶 | public/table-scroll.js、style.css | 多行宽表、左右同步、切换模块、窗口缩放 |
| 页面入口、静态资源 | public/index.html、server.mjs 静态白名单 | test/ui-contract.test.mjs、server.test.mjs |
| 总览、店铺、利润 | public/app.js、server.mjs 的 /api/dashboard、mcp.mjs | mcp.test.mjs、server.test.mjs |
| 商品同步、图片、库存字段 | sync.mjs、public/workbench.js、advanced.js | sync.test.mjs |
| 广告官方汇总报告 | campaign-report.mjs、public/official-ads.js、server.mjs 的 /api/reports | campaign-report.test.mjs |
| 广告小时诊断 | ads.mjs、public/ads.js、/api/ads | ads.test.mjs |
| 3/7/14日负毛利提醒 | sales-anomalies.mjs、public/sales.js | sales-anomalies.test.mjs |
| 关键词、竞品、Listing、素材、任务、日历、复盘 | public/workbench.js、advanced.js、workflows.js | ui-contract.test.mjs；涉及存储再测 workspace.test.mjs |
| MCP 协议、工具发现、分页 | mcp.mjs | mcp.test.mjs及使用它的业务模块测试 |
| 接口密钥配置 | settings.mjs、public/settings.js、/api/settings | settings.test.mjs、server.test.mjs |
| 登录、账号、退出、权限 | auth.mjs、public/login.*、accounts.js、server.mjs | auth.test.mjs、server.test.mjs |
| CSRF、统一网页请求 | public/api.js、server.mjs | server.test.mjs；检查所有写入入口 |
| 工作区结构、导入导出 | workspace.mjs、/api/workspace及对应前端 | workspace.test.mjs、业务相关测试 |
| 系统更新页面 | public/updates.js、index.html、update-bridge.mjs | server.test.mjs、updater.test.mjs |
| Docker 替换/备份/回滚 | updater/core.mjs、engine.mjs、agent.mjs | updater.test.mjs及 CI Docker 集成测试 |
| 部署、构建、安装 | Dockerfile、compose.yaml、install.sh、deploy.sh、install-autoupdate.sh、updater.compose.yaml、.github/workflows/docker.yml | CI及适用部署检查 |

## 增量工作流程（节省 token 与时间）

1. 用一句话明确本次改动及验收条件；已有信息足够时直接做，不重复确认。
2. 核对当前分支及远端，读取相关文件的差异；没有本地 Git 时用 GitHub 工具核对分支头和所需文件，不照搬旧副本覆盖新版本。
3. 根据定位表，只搜索相关模块。例如：

```sh
rg -n "tablewrap|scrollLeft" public/table-scroll.js public/style.css
rg -n "api/updates" server.mjs public/updates.js
```

4. 做最小可用修改，不顺便重排压缩文件、批量格式化、升级依赖或抽象无关模块。当前部分文件较紧凑，按定位片段编辑即可。
5. 做有意义的定向验证，不为了简单样式修改新增镜像实现的测试。验证通过且无新疑点后，不反复跑相同检查。
6. 涉及公共逻辑时扩大检查；CI 仍负责全量测试、真实 Docker 更新/恢复验证及双架构镜像发布。
7. 按授权只推本次变化；更新相关文档并简报结果。无法确认 NAS 状态时明确说明。

定向测试示例：

```sh
node --test test/sync.test.mjs
node --test test/auth.test.mjs test/server.test.mjs
node --test test/updater.test.mjs
```

完整检查：`node --test`。真实 Docker 集成测试在 Linux CI 中运行：`DOCKER_INTEGRATION=1 node --test test/updater-docker.test.mjs`；普通本地测试默认跳过该项。当前测试会创建专用测试容器和卷，不应指向生产目标做试验。

## 架构、接口与扩展方式

```text
浏览器 public/* → server.mjs（会话/CSRF/权限）
                    ├─ mcp.mjs → 赛狐 MCP → 业务模块
                    ├─ settings/auth/workspace → /app/data
                    └─ update-bridge → /updates 请求与状态
独立 updater/agent → Docker socket → 仅目标网站容器
```

主要路由：

| 路由 | 用途 |
|---|---|
| /healthz | 无登录健康检查 |
| /api/auth/status、login、bootstrap、logout | 登录状态、初始化和退出 |
| /api/accounts | 管理员账号管理 |
| /api/settings、/api/status | 密钥保存/测试与应用状态 |
| /api/dashboard、/api/ads | 利润总览与小时广告诊断 |
| /api/reports | 官方广告报告创建、列表、读取 |
| /api/sync/products、/api/sync/shipments | 商品库存与货件同步 |
| /api/sales-anomalies | 负毛利快照读取/同步 |
| /api/workspace | 工作区读取、记录写入、导入和删除 |
| /api/updates | 管理员读取状态、检查、安装、自动更新设置 |

新增模块：按已有模块方式组织前端，保留导航互斥和 hidden 行为；新增静态 JS 须同时加入 HTML 和服务器白名单。涉及写入使用 apiFetch，服务端验证输入与权限。不能仅靠隐藏按钮保护接口。新增数据集合须更新 collections、读取默认值、备份验证与对应界面，兼容历史备份。添加容器所需后端文件时检查 Dockerfile COPY。

## 业务口径：不可随意改变

- 总览是利润报表，不是经营看板；销售额、销量、毛利可能与其他报表不同。排查时先比对报表类型、店铺、日期、站点时区、币种及结算/发货口径。
- 原币种不直接跨币种相加；界面支持查询换算币种与原币种分别展示。
- 广告业务判断优先用完整日期范围的官方 SP 活动汇总报告。小时报告是诊断，不保证能代替完整汇总。报告须校验店铺、日期、类型、重复行及下载来源。
- ACOS = 花费 ÷ 归因销售额 ×100%，严格大于25%提醒。花费大于0且销售额0单独标识；缺字段、空报告、失败、未知不能当作0或正常。
- 最近3/7/14日各自读取，包含所选截止日；默认截至昨日。周期重叠不能累计。严格毛利润<0进入提醒；保存快照不代表实时数据。
- 商品图片来自接口返回，缺图使用占位，不猜造图片或补造指标。
- 关键词排名、竞品观察、负责人、补货周期、任务等部分内容来自人工/导入，不冒充赛狐实时数据。具体范围见 README 与 工作台结构.md。

## MCP 接入

服务地址 https://api-mcp.sellfox.com/mcp，密钥 X-MCP-Key 由网页管理员配置，服务器保存，不返回前端。

赛狐网关可能只暴露 sf_discover / sf_describe / sf_execute 三个外层工具，三个不代表仅有三个业务能力。未知业务先发现，缺完整当前契约再描述，按契约执行；mcp.mjs 负责握手、SSE、契约和分页。不要凭截图猜字段、参数或财务含义。分页未完成、限流和请求失败应明确显示；创建报告等可能有副作用的请求不盲目重试。

## 持久化与安全边界

- /app/data 是核心持久化目录；workspace.json 为串行、原子写入的工作区，version 当前为1。
- 集合：products、keywords、competitors、listings、inventory、tasks、searchterms、adjustments、shipments、assets、feedback、reviews、salesSnapshots。
- 账号及密码哈希由 auth.mjs 管理；会话在内存，网站重启后需重新登录。环境变量账号仅首次导入，不用于覆盖已有账号。
- 密钥 AES-256-GCM 加密保存，解密主密钥同在数据卷；不能把这种方式描述为数据卷泄露后仍安全。工作区导出不含密钥和账号。
- 写请求需要 CSRF token；代理下不要重新引入简单 Origin/Host 相等判断。读写权限以当前后端代码为准，不假定所有写入都只限管理员。
- 新增展示使用 textContent 等安全方式，外部数据不直接拼接为 HTML；不把真实业务数据放入日志或提交。

## 发布与系统更新

运行代码发布时核对版本位置：package.json、Dockerfile 镜像版本标签、server.mjs 状态接口、public/index.html 页头。当前版本号尚未集中生成，注意遗漏。

main 推送触发 .github/workflows/docker.yml：全量 Node 测试 → amd64 测试镜像 → 数据卷权限验证 → 真实容器更新/失败恢复验证 → 发布 GHCR latest 与提交 SHA 标签，支持 amd64/arm64。不要仅凭推送成功声称镜像可用。

**纯文档提交**不改版本及运行文件，使用 `[skip ci]` 避免无意义重建。若以后配置路径过滤，仍应保证运行文件、Docker 和测试变动能正常触发 CI。

部署约定：

| 项目 | 默认值 |
|---|---|
| 镜像 | ghcr.io/canmingwei27-star/amazon-work-web:latest |
| Compose 项目 / 服务 | amazon-work-web / dashboard |
| 网站容器 | amazon-work-web-dashboard-1 |
| 主机端口 → 容器 | 3080 → 3000 |
| 独立助手 | amazon-work-web-updater |
| 更新状态卷 | amazon-work-web_update-state → /updates |
| 更新备份卷 | amazon-work-web_update-backups → /backups，仅助手 |

这些是项目约定，不是实时 NAS 状态；不要在新环境中盲目操作同名资源。实际数据卷沿用已有挂载，不猜测或重建。

助手默认每300秒检查远端摘要，可由网页关闭自动安装。下载期间网站运行；安装停止网站、归档数据、保留旧容器、替换并检查健康，成功才删旧容器且不删数据卷。失败恢复旧容器，不自动倒退数据文件。备份最近5份、单份上限1GB。格式标签 io.amazon-work.data-schema 当前1，无标签旧镜像视作1；不兼容迁移必须另行设计，不能伪造标签绕过保护。

助手仅接受 check/install/configure 动作，不提供任意 Docker API 代理。网站不挂 socket，助手有主机 Docker 管理能力。静态 IP/共享其他容器网络等特殊部署拒绝自动替换。助手程序自身不随网站自动升级，修改 updater/* 后不能承诺已运行助手会自动获得新代码，须独立部署助手并保留状态、备份卷。

## 常见排查入口

| 现象 | 优先检查 |
|---|---|
| 数据对不上 | 报表口径/日期/店铺/币种，而非直接修改数值 |
| 广告只有活动ID、指标为空 | 是否取了活动列表或空小时数据；改查匹配日期的官方报告 |
| 跨站请求被拒绝 | apiFetch 的 CSRF、重启后旧页面令牌、代理配置 |
| Docker socket permission denied | NAS SSH 用户权限，必要时 sudo；不要 chmod 666 socket |
| 网页没有新功能 | CI 是否成功、镜像是否发布、助手日志、容器版本、刷新并重新登录 |
| 更新按钮不可用 | 管理员角色、助手心跳、/updates 挂载、进行中的更新 |
| 助手异常 | 只读查看 `sudo docker logs --tail=100 amazon-work-web-updater`，不要先删除容器和数据卷 |

## 新会话可直接使用的提示词

> 请接手 canmingwei27-star/Amazon-work-web。先读 AGENTS.md 和 docs/DEVELOPMENT.md 的定位表，核对当前远端分支。仅阅读并修改本次功能相关模块，做必要的定向验证，不扫描全仓库或重写无关功能。保持赛狐数据口径、登录权限和 Docker 数据卷兼容。此次需求：……；完成后是否推送：……。

## 后续维护记录

- v1.1.0：登录/账号/退出、产品缩略图、负毛利周期提醒、CSRF及报表来源修正。
- v1.2.0：网页系统更新与独立 Docker 更新助手。
- v1.2.1：长表格底部悬浮横向滚动条，随当前可见表格同步。
- v1.2.2：工作区表格表头吸顶固定，随横向滚动对齐，离开表格自动隐藏。

- v1.2.3：表头固定覆盖所有 main .tablewrap 表格，外层背景对齐卡片、内层裁切对齐表格，横向滚动不侵入卡片留白。
- v1.2.3 同步采用圆润毛玻璃工作区：渐变背景、半透明卡片、统一圆角；无 backdrop-filter 时保留浅色实底回退。

- v1.2.4：public/motion.js 管理导航切换轻量滑入；style.css 管理按下、悬停及弹窗反馈。尊重减少动态效果设置；不接管滚轮，不给同步横向滚动加平滑延迟。

- v1.2.5：业务表格金额、小数指标及百分比固定两位；计数和标识保留原类别。格式化只作用于展示，原始数据、计算、备份及原始详情保持精度。
