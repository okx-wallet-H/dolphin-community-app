# 海豚社区 App：UI 仓库协作总入口

**作者：Manus AI**  
**日期：2026-04-18**

## 一、入口说明

本文件是海豚社区 App 当前 **UI 协作的仓库总入口**。从现在开始，设计师、前端与负责人之间的 UI 协作，以仓库中的文件为准，不再依赖项目公共文件区作为最终审核依据。设计师进入仓库后，先看本文件，再按本文给出的阅读顺序与目录规则推进提交、审核与落地。

后续所有页面都必须遵循同一套审看制度。**未通过当前页，不进入下一页；未进入 `90-approved/` 的稿件，前端不得作为最终实现依据。** 我将继续作为总负责人统一审核风格、细节与交付质量，确保页面在视觉语言、结构节奏与高端质感上保持一致。

## 二、协作结论

| 主题 | 当前约定 |
|---|---|
| 唯一协作主入口 | GitHub 仓库 |
| 最终审核依据 | 仓库内文档与已审核目录 |
| 审核负责人 | Manus AI（总负责人） |
| 设计推进方式 | 逐页提交、逐页审核、逐页放行 |
| 页面风格要求 | 简洁、清爽、克制，不堆叠备注、用法说明和无必要辅助文字 |
| 页面顺序 | 钱包页 → 币种明细页 → 聊天交易卡片 → 赚币页 |
| 前端可读取终版位置 | `deliverables/ui-review/90-approved/` |
| 设计师提交位置 | `deliverables/ui-review/` 下对应批次目录 |

## 三、设计师进入仓库后的阅读顺序

设计师进入仓库后，不应直接开始出图，而应先读清楚边界、流程和提交方式。下面这一组文件已经构成当前项目的完整协作基线，建议严格按顺序阅读。

| 顺序 | 文件 | 作用 |
|---|---|---|
| 1 | [`deliverables/dolphin-community-app-ui-review-brief-20260418.md`](./deliverables/dolphin-community-app-ui-review-brief-20260418.md) | 冻结产品边界、功能边界与 UI 禁止改动项，防止设计方向跑偏 |
| 2 | [`deliverables/dolphin-community-app-ui-self-review-round2-20260418.md`](./deliverables/dolphin-community-app-ui-self-review-round2-20260418.md) | 查看我已完成的页面自审结果，理解已收口与仍需优化的细节 |
| 3 | [`deliverables/dolphin-community-app-ui-designer-kickoff-20260418.md`](./deliverables/dolphin-community-app-ui-designer-kickoff-20260418.md) | 读取正式开工说明，明确逐页任务范围和产出要求 |
| 4 | [`deliverables/dolphin-community-app-ui-review-workflow-20260418.md`](./deliverables/dolphin-community-app-ui-review-workflow-20260418.md) | 按统一评审机制推进，每轮只处理当前放行页面 |
| 5 | [`deliverables/dolphin-community-app-ui-repo-handoff-protocol-20260418.md`](./deliverables/dolphin-community-app-ui-repo-handoff-protocol-20260418.md) | 了解仓库互传规则、目录约定、命名方式与交接路径 |
| 6 | [`deliverables/dolphin-community-app-ui-public-files-index-20260418.md`](./deliverables/dolphin-community-app-ui-public-files-index-20260418.md) | 快速查看公共文件清单与它们之间的关系 |
| 7 | [`deliverables/dolphin-community-app-ui-model-prompt-pack-20260418.md`](./deliverables/dolphin-community-app-ui-model-prompt-pack-20260418.md) | 当需要调用 UI 设计师模型时，作为受控提示任务包使用 |

## 四、仓库中的提交与审核方式

后续 UI 产物应通过仓库进行留痕，而不是通过零散聊天描述推进。设计师应把阶段稿、对比说明与必要标注文件统一提交到 `deliverables/ui-review/` 下的对应目录。负责人完成审核后，只有通过的版本才会被整理进入 `deliverables/ui-review/90-approved/`，前端只读取这个终版目录，不读取未通过的探索稿。与此同时，页面本身必须保持简洁清爽，不要把备注、用法说明、解释性小字和无必要提示直接堆在正式界面上；此类信息如确有需要，应留在交付说明中，而不是占据用户界面。

| 角色 | 行为要求 |
|---|---|
| 设计师 | 只围绕当前放行页面提交稿件，不跨页发散，不擅自改产品边界，并主动删除无必要备注文字 |
| 负责人 | 逐页审看视觉统一性、交互表达、层级关系、质感细节、页面清爽度与可实现性 |
| 前端 | 只根据已审核终版稿开发，不提前消费未通过稿件 |

## 五、当前严格页面顺序

当前项目不允许并行跳页。页面必须按既定顺序推进，这样才能保证视觉系统统一，也便于我在每一页收口之后再进入下一页。

| 阶段 | 页面 | 当前要求 |
|---|---|---|
| 1 | 钱包页 | 先完成设计复核与最终放行 |
| 2 | 币种明细页 | 仅在钱包页通过后启动 |
| 3 | 聊天交易卡片 | 仅在币种明细页通过后启动 |
| 4 | 赚币页 | 仅在聊天交易卡片通过后启动 |

## 六、执行口径

后续如果设计师进入仓库查看，只需要先打开本文件，就能快速理解当前项目的 UI 协作方式、阅读顺序、提交路径与审核规则。自此以后，**仓库就是 UI 协作主场**，所有页面推进、文件交接、审核留痕与终版归档，都应以仓库为中心进行。
