# Signal Roadmap 本地验收单

验收结果：用户于 2026 年 9 月 7 日明确回复“通过”。
本地功能验收通过，允许进入公开发布流程；此结果不等于线上部署验收通过。

验收入口：http://127.0.0.1:3100

这是用户反馈与产品进度管理网站，不是原型设计工具或流量分析工具。
当前仅在这台电脑运行，未上传公开仓库，也未正式上线。

## 开始前

- 在同一个浏览器中完成流程，推荐 Chrome。
- 首页点击 **Start a private demo**，然后点击 **Open your feedback board**。
- 不需要注册。你获得的是独立演示空间，默认身份是普通成员。
- 示例人物和内容是虚构的，但提交、投票、评论等操作会真实写入本地数据库。
- 空间在 24 小时后过期；不要输入真实客户资料或其他敏感信息。
- 不要反复新建空间：每小时最多创建 5 次。保留当前页面地址即可继续操作。

## 基础验收（约 10 分钟）

| 操作           | 点击或填写                                                                                                              | 应看到的结果                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 提交建议       | Share feedback → 填 Title、Description、Board → Send feedback                                                           | 显示等待审核；点击 View your feedback 后刷新，内容仍在 |
| 投票           | 返回 Feedback，打开一条已公开建议，点 Vote                                                                              | 数量增加，刷新后保持；再次点击可取消                   |
| 评论           | 在已公开建议底部填写 Your comment → Post comment                                                                        | 评论出现，刷新后仍存在                                 |
| 关注           | 点 Follow updates；如果已是 Following updates，表示已关注                                                               | 刷新后关注状态保持                                     |
| 切换审核身份   | 顶部 Try moderator view                                                                                                 | 显示 Viewing as moderator，并出现审核入口              |
| 审核自己的建议 | Review queue → 找到刚才的标题 → Review idea → Approve and publish                                                       | 不再等待审核，可在反馈列表找到                         |
| 更新进度       | 在已关注建议详情选择 Roadmap status → Completed → Save status                                                           | Roadmap 的 Completed 区域出现这条建议                  |
| 发布更新日志   | Write a release → 填 Title、Summary、Release notes，勾选已完成建议 → Save draft → Publish release → Confirm publication | Changelog 列表和详情可看到刚才的内容                   |
| 检查通知       | Return to member view → Notifications                                                                                   | 能看到所关注建议的进度/发布通知                        |

这里的 **Publish release** 只是在你的本地演示空间发布更新日志，
不是把整个项目上传 GitHub 或部署到公网。

## 进阶验收：重复建议合并

1. 成员身份分别给下面两条建议投票，并在第一条写一条评论：
   - Send a weekly email recap for followed suggestions
   - A weekly digest of the ideas I follow
2. 保存第一条建议的页面地址。切换审核身份，打开第一条。
3. 展开 Merge a duplicate，在 Find the idea to keep 搜索第二条标题。
4. 点击 Keep …，核对两个标题，再确认 Merge into …。
5. 再次打开第一条的旧地址，应跳转至第二条。
6. Earlier conversations 应保留原评论和作者。同一个人给两条都投票，
   合并后只计一票。如果从全新演示空间严格按以上操作，合并后共 4 票。

合并不可通过普通界面撤销，请只在演示空间内体验。

## 本次验收的边界

- 可验收：反馈、搜索筛选、投票、评论、关注、审核、合并、路线图、
  更新日志、站内通知、演示空间隔离以及刷新后数据保存。
- 演示审核身份可管理看板和标签，但没有所有者权限。
- 真实邮件登录投递、线上 Redis、公开部署和对象存储上传尚未完成线上验收。
  Logo 上传暂未启用；不要把演示身份切换当成真实账号登录验证。
- 原有“每周摘要”等建议标题只是示例内容，不代表本网站已经实现邮件摘要等功能。
- 无计费、企业单点登录、自动发送产品通知邮件或自助账号导出/删除功能。

## 反馈问题

请记录“在哪个页面 → 点了什么 → 期望发生什么 → 实际发生什么”，
有截图更好。可以直接说“通过”“不通过”，或列出需要修改的地方。
只有你明确验收通过后，才会进入公开发布流程。
