# StuTrade Web

StuTrade Web 是 React + TypeScript 前端，通过 `/api/v1` 与业务宿主协作，并独立构建为静态产物。包管理器和脚本运行器统一使用 Bun。

## 当前能力

- React 19、TypeScript 6、Vite 8 和 Bun 1.4 基础工程。
- 桌面顶部导航与移动底部导航组成的响应式应用壳层。
- 市集浏览与详情，以及出售、求购、我的发布、停用和主动成交纵切。
- 待交付/已完成订单账簿、双方线下交付确认，以及撮合、个人、登录、注册和 404 路由入口。
- React Query 与会话 Provider 装配。
- [`openapi/stu-trade.yaml`](openapi/stu-trade.yaml) 及生成的 TypeScript 传输类型。
- MSW 开发/测试入口、组件行为测试、Oxlint 和完整构建检查。

当前撮合页面仍是骨架；MSW 已实现会话、市集、发布、本人列表、主动成交和订单履约流程。真实后端联调与浏览器 E2E 尚未完成。OpenAPI 中存在的其他 operation 不代表页面或后端 handler 已经完成。产品结构与设计边界见[组件说明](docs/project-description.md)，后续页面和联调工作见[实施方案](docs/implementation_plan.md)。

## 项目结构

```text
openapi/                    HTTP 结构契约
src/api/generated/          OpenAPI 生成类型，不手工编辑
src/app/                    应用装配、路由和壳层
src/features/               按业务职责组织的页面与状态
src/mocks/                  MSW browser/server 与 handlers
src/shared/                 已有多个调用方的共享界面
src/styles/                 全局样式和设计 token
public/                     无需构建处理的静态资源
```

HTTP 结构由本仓库的 OpenAPI 拥有；产品语义、宿主规则和跨组件边界由 StuTrade 主仓库文档拥有。前端不复制 ISBN、自买、状态转换、幂等或并发成交规则。

## 开发

```bash
bun install
bun run dev
```

开发服务器默认启用 MSW。连接真实后端时设置 `VITE_ENABLE_MSW=false`；`/api` 默认代理到 `http://127.0.0.1:8080`，可通过 `VITE_BACKEND_URL` 覆盖。

提交前运行：

```bash
bun run check
```

其他常用命令：

```bash
bun run api:lint
bun run api:check
bun run test
bun run test:watch
bun run build
```

## 文档索引

- [组件说明](docs/project-description.md)
- [实施方案](docs/implementation_plan.md)
- [工作流治理](docs/governance/workflow.md)
- [工程治理](docs/governance/engineering.md)
- [验证治理](docs/governance/verification.md)
- [仓库治理补充](docs/governance/repository.md)
