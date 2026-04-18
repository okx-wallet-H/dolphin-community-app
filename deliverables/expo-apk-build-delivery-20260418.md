# Android APK 构建交付说明

作者：**Manus AI**  
日期：2026-04-18

## 构建结果

本次已经使用新 Expo 账号 **`vip_888`** 成功触发并完成海豚社区 App 的 Android preview 构建。构建状态为 **`FINISHED`**，对应的 EAS Build ID 为 **`f0f8647a-58d8-4959-81e5-d15cb84b4113`**。[1]

| 项目 | 值 |
|---|---|
| Expo 账号 | `vip_888` |
| 项目 | `@vip_888/h3` |
| Build ID | `f0f8647a-58d8-4959-81e5-d15cb84b4113` |
| 状态 | `FINISHED` |
| Profile | `preview` |
| 平台 | `ANDROID` |
| Git 提交 | `be5122a74fec1d9c58cb366d1a557bb94bb9a139` |

## APK 下载入口

可直接下载的 APK 链接如下：

> https://expo.dev/artifacts/eas/vKRj4BJFt4oDxJi8HsoGza.apk

构建详情页如下：

> https://expo.dev/accounts/vip_888/projects/h3/builds/f0f8647a-58d8-4959-81e5-d15cb84b4113

## 说明

我已经确认该构建在 Expo 侧返回了 APK 产物字段 `applicationArchiveUrl` / `buildUrl`，并指向同一条 APK 下载链接。[1] 由于当前沙箱环境在大文件 TLS 传输时反复出现底层 SSL 读取异常，**我没能把 APK 完整下载到沙箱本地再作为文件附件上传**；但 Expo 已经生成了正式可访问的 APK 交付链接，你可以直接打开下载。[1]

## References

[1]: https://expo.dev/accounts/vip_888/projects/h3/builds/f0f8647a-58d8-4959-81e5-d15cb84b4113 "Expo EAS build details for build f0f8647a-58d8-4959-81e5-d15cb84b4113"
