# Expo 账号切换与 EAS 项目重绑结果

作者：**Manus AI**  
日期：2026-04-18

## 结论

本次已经把海豚社区 App 的 Expo 构建链路从旧账号切换到了你提供的新令牌对应账号，且**不仅令牌本身有效，仓库项目也已经重新绑定到新账号下的新 EAS 项目**。

新令牌直接验证结果显示，当前认证身份为 **`vip_888`**。[1] 进一步检查时发现，新令牌**无权访问旧的 EAS 项目** `174d6be5-8a0e-429a-8b8b-7b2ce9a8906d`，因此单纯替换 `EXPO_TOKEN` 并不足以完成切换，必须同步把仓库绑定的 Expo 项目一并迁移。[2]

随后，我已经在新账号下创建并绑定了新的 EAS 项目：**`@vip_888/h3`**，新项目 ID 为 **`5d37b918-426b-4a8c-84a3-9bb5e5762f40`**。[3] 仓库里的 `app.config.ts` 也已完成更新，并推送到 `main` 分支，最新提交为 **`be5122a`**。[4]

## 已完成的具体修改

| 项目 | 结果 |
|---|---|
| GitHub Actions Secret `EXPO_TOKEN` | 你已手动替换完成 |
| Expo 令牌有效性 | 已验证通过，对应账号为 `vip_888` |
| 旧 EAS 项目访问 | 新令牌无权限访问旧项目，已确认 |
| 新 EAS 项目 | 已创建 `@vip_888/h3` |
| 新 Project ID | `5d37b918-426b-4a8c-84a3-9bb5e5762f40` |
| 仓库配置 | 已把 `owner` 更新为 `vip_888`，并把 `extra.eas.projectId` 更新为新项目 ID |
| Git 提交与推送 | 已推送到 `main`，提交 `be5122a` |

## 当前验证结果

在仓库配置更新后，重新执行 EAS 项目信息读取，已经可以正常返回：

> `fullName  @vip_888/h3`  
> `ID        5d37b918-426b-4a8c-84a3-9bb5e5762f40` [3]

随后又读取了该项目的 Android build 列表，命令成功返回空数组 `[]`，这说明**新账号下的项目访问链路已经打通**，只是当前新项目里还没有历史构建记录。[5]

## 我这次没有主动做的事

我**没有直接再触发一次新的云端 APK 构建**。这是刻意保守处理，因为你刚刚才明确提出要避开旧账号的扣费问题；在没有你明确说“现在就重新出包”的前提下，我避免了再次触发新的云端计费。

## 现在的状态

现在仓库已经处于**可继续用新 Expo 账号发起构建**的状态。下一步如果你要我继续，我可以直接帮你：

1. 再次触发 Android preview APK 构建；
2. 跟踪新账号下的 EAS 构建页面；
3. 拿到新的 APK 下载链接后交付给你。

## References

[1]: https://docs.expo.dev/eas/environment-variables/#built-in-environment-variables "EAS CLI token-based authentication context"
[2]: https://docs.expo.dev/eas/project-id/ "Expo EAS project ID linkage"
[3]: https://expo.dev/accounts/vip_888/projects/h3 "New Expo project under vip_888"
[4]: https://github.com/okx-wallet-H/dolphin-community-app/commit/be5122a "Git commit: rebind expo project to new account"
[5]: https://docs.expo.dev/build-reference/build-list/ "EAS Build list command reference"
