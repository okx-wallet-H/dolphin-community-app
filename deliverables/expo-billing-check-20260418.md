# Expo 账单核查说明

作者：**Manus AI**  
日期：2026-04-18

## 结论

我核查后可以明确说，**目前更像是“当月构建额度已经用完并产生超额费用”**，而**不是已经出现明确的欠费停服状态**。[1] [2] 账单页显示当前账户 `hwallet` 的计划是 **Starter**，并且已经生成了一张 **Upcoming bill**，而不是 `overdue`、`past due` 或 `payment failed` 之类的异常提示；对账单页源码关键词进一步核查后，也没有发现这些欠费信号。[1]

## 当前账单情况

| 项目 | 金额 | 含义 |
|---|---:|---|
| Starter 基础月费 | $19.00 | 当前套餐月费 |
| Additional Usage - Builds | $137.00 | 超出包含额度后的额外构建费用 |
| Additional Usage - Workflows | $0.00 | 当前没有额外工作流费用 |
| Upcoming bill | $156.00 | 预计在 2026-05-15 出账 |

从账单结构看，**主要费用不是套餐本身，而是额外构建**。额外构建费用 `137 美元` 占当前预计总账单 `156 美元` 的约 **87.82%**；同时，这部分超额费用约为 Starter 所含 `45 美元` build credit 的 **3.04 倍**。[1] [2]

## 为什么会这样

Expo 官方价格页显示，**Starter** 计划每月费用为 **19 美元**，包含 **45 美元的 build credit**；超过后会进入 **usage-based pricing**。[2] 官方 usage-based pricing 文档进一步说明，EAS Build 在超额后会按单次高优先级构建收取固定费用，并按月汇总结算。[3]

> Expo applies usage-based billing for customers who exceed their plan allowances. [3]

> For EAS Build, a flat fee is charged for an individual build executed at higher-priority levels. This is totaled monthly and charged at the end of your billing period. [3]

同一份官方文档给出的示例中，`Android builds (medium)` 的示例价格为 **1 美元/次**，`iOS builds (large)` 的示例价格为 **4 美元/次**。[3] 因此，如果你们这段时间主要是 Android 中等规格构建，那么当前 `137 美元` 的额外费用，粗略上就相当于 **约 137 次超额 Android medium build**；把包含的 `45 美元` credit 一起算进去，本期总 build 消耗大约相当于 **182 美元**的构建额度。[2] [3]

## 费用算不算贵

这要分场景看。

| 场景 | 判断 |
|---|---|
| 偶尔手工出几个测试包 | **偏贵**。因为 Starter 本来只要 19 美元/月，而你们现在预计总账单已经到 156 美元，约为基础月费的 **8.21 倍**。 |
| 频繁做 CI、反复打测试包、多人并行迭代 | **不算异常**。如果这段时间你们频繁触发 EAS 云端构建，超出 45 美元 credit 后，费用会很快累计。 |
| 希望长期低成本反复出 APK | 可以考虑把一部分 Android APK 构建迁到你们自己的服务器或本地 CI，把 Expo 留给必要的云构建场景。 |

## 最直接的判断

如果你的问题是“**是不是欠费了**”，我的判断是：**目前不像欠费，更像是本月 build credit 用完了，并且已经累计出较高的超额构建费用**。[1] [2] [3]

如果你的问题是“**那么贵吗**”，我的判断是：**对一个 Starter 套餐来说，这个月确实已经不便宜了**，因为费用主体已经不是月费，而是大量额外构建带来的 usage charges。[1] [2] [3]

## References

[1]: https://expo.dev/accounts/hwallet/settings/billing "Expo Billing page for hwallet"
[2]: https://expo.dev/pricing "Expo Application Services Pricing"
[3]: https://docs.expo.dev/billing/usage-based-pricing/ "Expo Docs: Usage-based pricing"
