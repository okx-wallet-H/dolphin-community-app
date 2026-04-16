# 后端入口探查记录

- 访问地址：`https://h-wallet-api-v2.vercel.app/`
- 首页返回 JSON：`{"ok":true,"timestamp":1776141620648}`
- 当前观察结果：根路径仅像健康检查接口，暂未直接暴露余额接口文档或路由索引。
- 已保存的页面 HTML：`/home/ubuntu/upload/h-wallet-api-v2.vercel.app__1776141643067.html`
- 后续动作建议：
  1. 在项目代码中搜索该域名与余额接口调用路径。
  2. 结合原仓库或后端实现，确认余额 API 的具体 endpoint 与返回结构。
  3. 对聊天页的实时价格查询优先考虑直接调用 OKX 行情接口，避免等待后端文档。
