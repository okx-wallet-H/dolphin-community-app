# 海豚社区 App：UI 仓库协作总入口

**作者：Manus AI**  
**日期：2026-04-18**

本文件是海豚社区 App 当前的 **UI 仓库协作总入口**。设计师、总负责人和前端同学进入仓库后，应先阅读本文件，再进入具体页面目录与协作文档。自本轮起，UI 设计稿提交、负责人审核回写与前端接收，统一以**仓库内协作**为准，不再以仓库外的零散沟通作为正式依据。

## 一、当前协作结论

| 主题 | 当前约定 |
|---|---|
| 唯一正式协作主入口 | GitHub 仓库 |
| 设计提交与审核主目录 | `deliverables/ui-review/` |
| 页面推进方式 | 逐页提交、逐页审核、逐页放行 |
| 页面顺序 | 钱包页 → 币种明细页 → 聊天交易卡片 → 赚币页 |
| 当前优先页 | 钱包页 Round 1 |
| 前端唯一终版来源 | `deliverables/ui-review/90-approved/` |
| 审核机制 | 未通过当前页，不进入下一页 |

## 二、设计师进入仓库后的阅读顺序

设计师进入仓库后，不应直接开始出图，而应先读清楚边界、流程和提交方式。请按以下顺序阅读。

| 顺序 | 文件 | 作用 |
|---|---|---|
| 1 | `UI-COLLAB-README.md` | 仓库内 UI 协作总入口 |
| 2 | `deliverables/ui-review/00-briefs/dolphin-community-app-ui-repo-handoff-protocol-20260418.md` | 了解仓库互传规则、目录约定、命名方式与交接路径 |
| 3 | `deliverables/ui-review/00-briefs/dolphin-community-app-ui-review-brief-20260418.md` | 冻结产品边界、功能边界与 UI 禁止改动项 |
| 4 | `deliverables/ui-review/00-briefs/dolphin-community-app-ui-review-workflow-20260418.md` | 理解统一评审机制与交付节奏 |
| 5 | `deliverables/ui-review/00-briefs/dolphin-community-app-ui-designer-kickoff-20260418.md` | 明确逐页任务范围与产出要求 |
| 6 | `deliverables/ui-review/00-briefs/dolphin-community-app-ui-model-prompt-pack-20260418.md` | 当需要调用 UI 设计师模型时作为受控提示任务包 |
| 7 | 当前允许提交页面对应的 round 目录 | 进入具体页面提交与修改 |

## 三、仓库目录与角色分工

本轮 UI 协作材料统一放在 `deliverables/ui-review/` 下，并按页面与轮次拆分。

| 目录 / 角色 | 用途 / 职责 | 约束 |
|---|---|---|
| `deliverables/ui-review/00-briefs/` | 冻结边界、评审规则、开工说明、模型提示包 | 作为所有页面提交前的共同依据 |
| `deliverables/ui-review/10-wallet/round-01/` | 钱包页 Round 1 提交与审核文件 | 当前优先页 |
| `deliverables/ui-review/20-token-detail/round-01/` | 币种明细页提交与审核文件 | 仅在钱包页通过后启动 |
| `deliverables/ui-review/30-chat-card/round-01/` | 聊天交易卡片提交与审核文件 | 仅在上一页通过后启动 |
| `deliverables/ui-review/40-earn/round-01/` | 赚币页提交与审核文件 | 仅在上一页通过后启动 |
| `deliverables/ui-review/90-approved/` | 负责人签字通过后的终版稿 | 前端只认这里 |
| UI 设计师 | 逐页提交设计图、说明文档、对照清单 | 不得跳页，不得脱离边界自由发挥 |
| 总负责人 | 统一审核并回写结论 | 未通过当前页，不放行下一页 |
| 前端 | 只读取已批准终稿进行实现 | 不读取过程稿 |

## 四、单页提交必须包含的文件

以钱包页 Round 1 为例，单页提交必须齐备以下四类文件；缺任何一项，均视为未提交。

| 文件类型 | 示例文件名 | 说明 |
|---|---|---|
| 设计图 | `wallet-page-round01-v01.png` | 必须为完整页面图，不得只截局部 |
| 说明文档 | `wallet-page-round01-notes.md` | 说明本轮目标、设计判断与待确认项 |
| 对照清单 | `wallet-page-round01-checklist.md` | 逐条对应边界文件、任务要求与前轮反馈 |
| 审核结论 | `wallet-page-round01-review.md` | 由总负责人回写 |

## 五、审核与前端接收规则

后续 UI 产物必须通过仓库留痕，而不是通过零散聊天描述推进。负责人完成审核后，只有通过的版本才会被整理进入 `deliverables/ui-review/90-approved/`；前端只读取这个终版目录，不读取未通过的探索稿。

| 规则 | 执行方式 |
|---|---|
| 未通过当前页，不进入下一页 | 负责人未签字放行前，设计师不得跳页 |
| 未进入 `90-approved/` 的稿件，前端不得实现 | 前端只根据终版稿开发 |
| 页面必须保持简洁、清爽、克制 | 备注、解释性小字与过程说明不应堆在正式界面上 |
| 所有协作应可追踪 | 以仓库文件、目录与提交记录为准 |

## 六、当前执行提醒

当前仍处于 **钱包页 Round 1** 阶段。请先完成并通过钱包页，再进入币种明细页、聊天交易卡片和赚币页。后续所有页面都必须遵循同一套审看制度，以保证视觉语言、结构节奏与高端质感保持一致。
