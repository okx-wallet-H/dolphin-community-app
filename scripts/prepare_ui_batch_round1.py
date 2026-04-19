from pathlib import Path
import shutil

root = Path('/home/ubuntu/dolphin-community-app')
ui_review = root / 'deliverables' / 'ui-review'
brief_rel = '../../00-briefs'

pages = [
    {
        'key': 'wallet',
        'dir': ui_review / '10-wallet' / 'round-01',
        'png_src': root / 'deliverables' / 'dolphin-community-app-wallet-review-design-20260418.png',
        'png_name': 'wallet-page-round01-v01.png',
        'title': '钱包页',
        'notes_name': 'wallet-page-round01-notes.md',
        'checklist_name': 'wallet-page-round01-checklist.md',
        'review_name': 'wallet-page-round01-review.md',
        'goal': '在当前 MVP 冻结边界内，把钱包页收成更像正式金融产品首页的版本，继续坚持“资产列表是主入口、点击币种进入账号明细”的主路径，不新增业务入口，不改写产品职责。',
        'judgment': '本稿将总资产估值与链上资产分组列表重新拉回首屏中心，使用户一进入页面就先看到资产、再看到链和币种层级，而不是先被辅助模块分散注意力。视觉上继续沿用白色、淡紫、浅灰的统一金融科技语言，避免另起一套过度炫技或偏 Web3 海报感的风格。',
        'focus_rows': [
            ('主路径是否清楚', '资产总览卡 + 链上资产列表成为首屏主角', '是否足够像正式钱包首页'),
            ('辅助模块是否降噪', '安全摘要与自动任务下沉到资产列表之后', '是否还需要继续压缩'),
            ('顶部身份感是否成立', '用“钱包”主标题配合“资产总览”轻标签', '是否需要进一步稳住页级标题层级'),
            ('统一风格是否成立', '白底、浅紫、浅灰、圆角卡片体系保持统一', '是否可作为后续页面的基线'),
        ],
        'pending': '顶部“钱包 / 资产总览”的层级差是否还要继续强化，Hero 卡内数据来源说明是否还要进一步减弱，以及首屏底部的“钱包安全摘要”“自动任务”是否仍应继续压缩。',
        'boundary_rows': [
            ('资产列表是主入口', '是', '资产总览与链上资产列表成为首屏主角'),
            ('点击币种进入账号明细', '是', '未移除币种进入明细的产品语义'),
            ('不新增业务入口', '是', '未增加新的功能按钮、弹层或新路径'),
            ('不另起风格体系', '是', '继续使用白色、淡紫、浅灰统一语言'),
        ],
        'review_rows': [
            ('顶部标题层级', '基本成立，但仍可更稳', '是'),
            ('Hero 卡信息密度', '已压缩，但来源说明略显醒目', '是'),
            ('首屏辅助模块节奏', '已降噪，但仍有继续压缩空间', '是'),
            ('是否可作为后续页面基线', '倾向可以', '是'),
        ],
    },
    {
        'key': 'token-detail',
        'dir': ui_review / '20-token-detail' / 'round-01',
        'png_src': root / 'deliverables' / 'dolphin-community-app-token-detail-review-design-20260418.png',
        'png_name': 'token-detail-page-round01-v01.png',
        'title': '币种明细页',
        'notes_name': 'token-detail-page-round01-notes.md',
        'checklist_name': 'token-detail-page-round01-checklist.md',
        'review_name': 'token-detail-page-round01-review.md',
        'goal': '在不改变“单币种账户页 / 账本页”职责的前提下，提升币种明细页的账本感、可信度与金融产品完成度，让用户看到的是可以用于查看资产状态与历史明细的正式页面。',
        'judgment': '本稿将余额概览、可用 / 冻结状态、关键资产动作和账本明细纵向串联起来，强调信息可核对、结构可追踪，而不是将页面做成营销型详情页。视觉上延续钱包页的白底、浅紫、浅灰卡片语言，使其与钱包页形成明确的父子页面关系。',
        'focus_rows': [
            ('账本感是否成立', '余额概览、状态分区、明细列表按可信顺序排布', '是否足够像正式账户页'),
            ('金额与单位语义', '币量、法币估值与状态字段做了分区', '是否仍有歧义风险'),
            ('操作区克制程度', '发送、接收、兑换动作保留但不喧宾夺主', '是否需要继续压缩'),
            ('与钱包页风格连续性', '卡片圆角、标题与留白体系保持同源', '是否已形成连续页面系统'),
        ],
        'pending': '顶部余额概览是否还要更像“账户摘要”而不是“运营卡片”，账本列表行高是否需要继续压缩，以及关键动作区是否还应进一步降低存在感。',
        'boundary_rows': [
            ('页面职责仍为单币种账户页', '是', '未将页面改造成资讯页或活动页'),
            ('账户信息应可信可核对', '是', '余额、法币估值、状态与明细保持分层'),
            ('不新增主路径外流程', '是', '未新增新的复杂流程入口'),
            ('延续统一风格体系', '是', '继续使用白色、淡紫、浅灰与统一圆角'),
        ],
        'review_rows': [
            ('账本可信度', '方向正确，但仍需负责人判断是否足够稳', '是'),
            ('金额语义区分', '已加强，但仍建议重点复核', '是'),
            ('动作区克制程度', '基本受控，但可能还能再弱化', '是'),
            ('与钱包页衔接', '整体连续，但仍需总负责人定稿', '是'),
        ],
    },
    {
        'key': 'chat-card',
        'dir': ui_review / '30-chat-card' / 'round-01',
        'png_src': root / 'deliverables' / 'dolphin-community-app-chat-card-review-design-20260418.png',
        'png_name': 'chat-card-page-round01-v01.png',
        'title': '聊天交易卡片页',
        'notes_name': 'chat-card-page-round01-notes.md',
        'checklist_name': 'chat-card-page-round01-checklist.md',
        'review_name': 'chat-card-page-round01-review.md',
        'goal': '在不改变聊天主场景的前提下，把交易卡片收成更像“服务单 / 执行结果确认卡”的表现，而不是控制台式的参数面板，从而提升可信度和可读性。',
        'judgment': '本稿将对话内容与交易卡片做清晰分区，卡片内部强调执行结果、关键资产信息、状态摘要和可执行动作，使其更接近被 AI 助手整理好的服务结果单。整体仍沿用白底、淡紫、浅灰系统，避免突然切到强烈控制台或图表面板风格。',
        'focus_rows': [
            ('是否从控制台感收成服务单感', '参数密度被压缩，结果与状态被前置', '是否已足够接近目标气质'),
            ('聊天主场景是否仍成立', '对话气泡与交易卡片的主次关系更清楚', '是否会被卡片抢戏'),
            ('状态与动作是否可信', '结果摘要、状态标签和动作按钮进行了分层', '是否还需要继续降噪'),
            ('跨页风格是否统一', '配色、留白与圆角体系与前两页保持一致', '是否可纳入统一风格系统'),
        ],
        'pending': '交易卡片标题区是否还应继续弱化“系统感”，状态标签是否仍然略重，以及执行按钮是否需要更像服务确认而不是交易台按钮。',
        'boundary_rows': [
            ('聊天仍是页面主场景', '是', '未将页面重做为纯控制台或表单页'),
            ('交易卡片承担服务单角色', '是', '强调结果、状态与动作，而非参数堆叠'),
            ('不新增越界功能入口', '是', '未增加额外业务分支或复杂编辑流程'),
            ('延续统一视觉系统', '是', '继续使用统一的浅色金融科技语言'),
        ],
        'review_rows': [
            ('服务单感是否成立', '方向明显改善，但需总负责人定稿', '是'),
            ('卡片与对话主次', '基本清楚，但仍建议重点复核', '是'),
            ('状态标签权重', '略重，建议负责人裁定是否继续收', '是'),
            ('整体质感统一性', '已与前两页接轨', '是'),
        ],
    },
    {
        'key': 'earn',
        'dir': ui_review / '40-earn' / 'round-01',
        'png_src': root / 'deliverables' / 'dolphin-community-app-earn-review-design-20260418.png',
        'png_name': 'earn-page-round01-v01.png',
        'title': '赚币页',
        'notes_name': 'earn-page-round01-notes.md',
        'checklist_name': 'earn-page-round01-checklist.md',
        'review_name': 'earn-page-round01-review.md',
        'goal': '在不把页面做成活动会场的前提下，让赚币页更像真实产品列表页，使收益产品本身成为主角，同时保持克制、可信和可落地的金融产品观感。',
        'judgment': '本稿把收益产品列表、期限 / 风险 / 年化等关键信息前置，并压弱过强的运营包装，使用户先看到产品、再看到辅助说明。视觉上延续统一浅色体系，以确保赚币页虽然是收益场景，但不会突然脱离整套 App 的风格基线。',
        'focus_rows': [
            ('真实产品是否成为主角', '产品列表与关键信息成为页面中心', '是否已符合产品页预期'),
            ('页面是否足够克制可信', '运营氛围已被压弱，收益信息更结构化', '是否还需要继续去活动感'),
            ('筛选与辅助信息是否适度', '筛选与说明保留但不抢主内容', '是否要进一步收紧'),
            ('与其余页面风格统一性', '统一沿用白底、浅紫、浅灰语言', '是否可视为同一产品系统'),
        ],
        'pending': '收益率视觉强调是否仍略强，产品卡内部信息层级是否还要更像正式金融列表，以及顶部说明区是否需要继续减弱存在感。',
        'boundary_rows': [
            ('页面主角应为真实产品列表', '是', '收益产品信息而非活动物料成为页面中心'),
            ('不改成会场或海报页', '是', '未采用强运营或大促式表现'),
            ('保留金融产品可信度', '是', '期限、风险、收益等字段按结构化方式呈现'),
            ('延续统一风格体系', '是', '继续使用与其他页面一致的浅色金融科技语言'),
        ],
        'review_rows': [
            ('真实产品感', '基本成立，但仍需总负责人确认', '是'),
            ('去活动化程度', '已明显改善，仍可继续打磨', '是'),
            ('信息层级稳定性', '方向正确，建议重点复核', '是'),
            ('整套页面统一性', '与前三页已较为一致', '是'),
        ],
    },
]

package_doc = ui_review / 'ui-batch-round01-handoff-20260419.md'
package_doc.write_text(
    '# 海豚社区 App：四页界面整包提交通知（Round 1）\n\n'
    '**作者：Manus AI**  \n'
    '**日期：2026-04-19**  \n'
    '**身份：UI 设计师整包提交稿**\n\n'
    '本次按最新协作要求，不再停留在单页推进，而是将 **钱包页、币种明细页、聊天交易卡片、赚币页** 四个界面作为一个整包提交到仓库，供总负责人一次性统一检查，并集中整理修改意见。整包仍然遵守仓库协作目录、命名与审核留痕规则，只是本轮由逐页放行调整为先整包初审、后集中回改。\n\n'
    '## 一、整包包含页面\n\n'
    '| 顺序 | 页面 | 目录 | 设计图 |\n'
    '|---|---|---|---|\n'
    '| 1 | 钱包页 | `deliverables/ui-review/10-wallet/round-01/` | `wallet-page-round01-v01.png` |\n'
    '| 2 | 币种明细页 | `deliverables/ui-review/20-token-detail/round-01/` | `token-detail-page-round01-v01.png` |\n'
    '| 3 | 聊天交易卡片 | `deliverables/ui-review/30-chat-card/round-01/` | `chat-card-page-round01-v01.png` |\n'
    '| 4 | 赚币页 | `deliverables/ui-review/40-earn/round-01/` | `earn-page-round01-v01.png` |\n\n'
    '## 二、本轮提交结构\n\n'
    '每个页面目录都包含设计图、说明文档、对照清单，以及预留给总负责人回写的审核结论文档。这样总负责人可以一次性横向比对四页的风格统一性、语义可信度、产品边界控制和前端可落地性。\n\n'
    '## 三、请总负责人统一检查\n\n'
    '| 检查维度 | 本轮重点 |\n'
    '|---|---|\n'
    '| 风格统一性 | 四页是否已经形成同一套白底、浅紫、浅灰、圆角卡片的金融科技语言 |\n'
    '| 页面职责 | 各页是否仍守住钱包、账本、服务单、收益产品列表各自职责 |\n'
    '| 语义可信度 | 币种、金额、状态、收益与动作语义是否稳定可信 |\n'
    '| 前端可落地性 | 是否可映射到现有代码结构与设计令牌体系 |\n\n'
    '## 四、当前交接说明\n\n'
    '本轮为 **整包初审提交**，尚未进入 `deliverables/ui-review/90-approved/`。请总负责人统一回写四页审核意见后，我将再按集中修改意见进入下一轮回改。\n'
)

for p in pages:
    p['dir'].mkdir(parents=True, exist_ok=True)
    shutil.copyfile(p['png_src'], p['dir'] / p['png_name'])

    notes = f'''# {p['title']} Round 1 设计说明

**作者：Manus AI**  
**日期：2026-04-19**  
**身份：UI 设计师整包提交稿**

## 一、本轮目标

{p['goal']}[1] [2]

## 二、本轮设计判断

{p['judgment']}[2] [3]

## 三、请总负责人重点审看

| 审看项 | 本轮处理 | 希望获得的判断 |
|---|---|---|
'''
    for a,b,c in p['focus_rows']:
        notes += f'| {a} | {b} | {c} |\n'
    notes += f'''\n## 四、当前仍待负责人拍板的点

{p['pending']}[2] [3]

## 五、提交说明

本页作为“四页界面整包 Round 1”的组成部分，与其余三个页面一起进入本轮统一初审。当前目录已包含设计图、说明文档、对照清单，以及等待总负责人回写的审核结论文档。[1]

## References

[1]: {brief_rel}/dolphin-community-app-ui-repo-handoff-protocol-20260418.md "海豚社区 App：UI 仓库互传协作入口"
[2]: {brief_rel}/dolphin-community-app-ui-review-brief-20260418.md "海豚社区 App：UI 审看约束与对接说明"
[3]: ../../../ui-batch-round01-handoff-20260419.md "海豚社区 App：四页界面整包提交通知（Round 1）"
'''
    (p['dir'] / p['notes_name']).write_text(notes)

    checklist = f'''# {p['title']} Round 1 对照清单

**作者：Manus AI**  
**日期：2026-04-19**

## 一、页面范围检查

| 检查项 | 结果 | 说明 |
|---|---|---|
| 当前提交页面是否为{p['title']} | 是 | 页面归档正确 [1] |
| 是否纳入本轮四页整包提交 | 是 | 本页与另外三页一起提交给总负责人统一检查 [1] [3] |
| 是否进入正确目录 | 是 | 已放入 `{p['dir'].relative_to(root)}` [1] |

## 二、文件齐套检查

| 文件 | 是否已提交 | 说明 |
|---|---|---|
| `{p['png_name']}` | 是 | 完整页面图，不是局部截图 [1] |
| `{p['notes_name']}` | 是 | 说明本轮目标、判断与待审点 [1] |
| `{p['checklist_name']}` | 是 | 当前文件 [1] |
| `{p['review_name']}` | 是 | 已预留负责人回写文档 [1] |

## 三、冻结边界对照

| 冻结边界 | 本稿是否遵守 | 说明 |
|---|---|---|
'''
    for a,b,c in p['boundary_rows']:
        checklist += f'| {a} | {b} | {c} [2] |\n'
    checklist += '\n## 四、总负责人重点复核项\n\n| 项目 | 当前状态 | 是否需负责人裁决 |\n|---|---|---|\n'
    for a,b,c in p['review_rows']:
        checklist += f'| {a} | {b} | {c} |\n'
    checklist += f'''\n## 五、提交结论

本页已按仓库互传规则完成目录、命名与文件组装，并已纳入本轮四页界面整包提交，可以进入总负责人统一初审阶段。[1] [3]

## References

[1]: {brief_rel}/dolphin-community-app-ui-repo-handoff-protocol-20260418.md "海豚社区 App：UI 仓库互传协作入口"
[2]: {brief_rel}/dolphin-community-app-ui-review-brief-20260418.md "海豚社区 App：UI 审看约束与对接说明"
[3]: ../../../ui-batch-round01-handoff-20260419.md "海豚社区 App：四页界面整包提交通知（Round 1）"
'''
    (p['dir'] / p['checklist_name']).write_text(checklist)

    review = f'''# {p['title']} Round 1 审核结论

**作者：Manus AI**  
**日期：2026-04-19**  
**身份：总负责人回写区（待填写）**

## 一、审核状态

待总负责人回写。

## 二、审核结论

待总负责人统一初审后填写本页结论。

## 三、修改意见

待总负责人统一补充。
'''
    (p['dir'] / p['review_name']).write_text(review)

print('Prepared batch package for 4 pages.')
