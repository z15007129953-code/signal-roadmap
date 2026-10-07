export const LOCALE_COOKIE = "signal-locale";
export const DEFAULT_LOCALE = "en" as const;
export const LOCALES = ["en", "zh"] as const;

export type Locale = (typeof LOCALES)[number];

/** Keep locale input untrusted: unsupported or missing values always use English. */
export function parseLocale(value: string | null | undefined): Locale {
  return value === "zh" ? "zh" : DEFAULT_LOCALE;
}

export type I18nMessages = {
  shell: {
    skipToContent: string;
    workspace: string;
    feedback: string;
    roadmap: string;
    changelog: string;
    notifications: string;
    settings: string;
    writeRelease: string;
    reviewQueue: string;
    release: string;
    review: string;
    privateDemo: string;
    demoWorkspaceName: string;
    demoWorkspaceDescription: string;
    demoExpiryNotice: string;
    expires: string;
    viewingAs: string;
    member: string;
    moderator: string;
    tryModeratorView: string;
    returnToMemberView: string;
    changingView: string;
    footer: string;
  };
  home: {
    preview: string;
    title: string;
    ready: string;
    description: string;
    noAccount: string;
    metricsLabel: string;
    metricDemo: string;
    metricStates: string;
    metricWorkspace: string;
    workflow: string;
    step1Title: string;
    step1Body: string;
    step2Title: string;
    step2Body: string;
    step3Title: string;
    step3Body: string;
    footer: string;
  };
  status: {
    new: string;
    reviewing: string;
    planned: string;
    inProgress: string;
    completed: string;
    declined: string;
    closed: string;
  };
  demo: {
    start: string;
    creating: string;
    ready: string;
    openBoard: string;
    requestLimit: string;
    requestLimitWait: (seconds: number) => string;
    createFailed: string;
  };
};

export const messages: Record<Locale, I18nMessages> = {
  en: {
    shell: {
      skipToContent: "Skip to content",
      workspace: "Workspace",
      feedback: "Feedback",
      roadmap: "Roadmap",
      changelog: "Changelog",
      notifications: "Notifications",
      settings: "Settings",
      writeRelease: "Write a release",
      reviewQueue: "Review queue",
      release: "Write a release",
      review: "Review queue",
      privateDemo: "Private workspace",
      demoWorkspaceName: "Feedback workspace",
      demoWorkspaceDescription:
        "A private place to share ideas, follow progress, and see what happens next.",
      demoExpiryNotice:
        "Your workspace expires 24 hours after it was created. Do not add sensitive information.",
      expires:
        "Your workspace expires 24 hours after it was created. Do not add sensitive information.",
      viewingAs: "Viewing as",
      member: "member",
      moderator: "moderator",
      tryModeratorView: "Try moderator view",
      returnToMemberView: "Return to member view",
      changingView: "Changing view…",
      footer: "A clear place for ideas and the decisions that follow.",
    },
    home: {
      preview: "PRIVATE WORKSPACE",
      title: "Product feedback, in one place.",
      ready: "READY",
      description:
        "Bring feedback into the open. Share a suggestion, find related ideas, and see where each one stands.",
      noAccount: "No account needed. Explore the full flow for 24 hours.",
      metricsLabel: "What you can explore",
      metricDemo: "ACCESS",
      metricStates: "STATUS STAGES",
      metricWorkspace: "SPACE",
      workflow: "WORKFLOW",
      step1Title: "Find the conversation",
      step1Body:
        "Browse by board, tag or status. Search for an idea before adding your own.",
      step2Title: "Give it some context",
      step2Body:
        "Describe the problem and what would help. Member submissions start in review.",
      step3Title: "Keep the status visible",
      step3Body:
        "Every idea has a readable state, from under review to completed.",
      footer:
        "Share feedback, discuss ideas, and follow decisions in one private workspace.",
    },
    status: {
      new: "New",
      reviewing: "Under review",
      planned: "Planned",
      inProgress: "In progress",
      completed: "Completed",
      declined: "Declined",
      closed: "Closed",
    },
    demo: {
      start: "Start exploring",
      creating: "Preparing your space…",
      ready: "Your feedback space is ready.",
      openBoard: "Open your feedback space",
      requestLimit:
        "Too many requests. Wait a few minutes before trying again.",
      requestLimitWait: (seconds) =>
        `Too many requests. Wait ${seconds} seconds before trying again.`,
      createFailed:
        "We could not prepare your feedback space. Check your connection and try again shortly.",
    },
  },
  zh: {
    shell: {
      skipToContent: "跳到主要内容",
      workspace: "工作区",
      feedback: "反馈",
      roadmap: "路线图",
      changelog: "更新日志",
      notifications: "通知",
      settings: "设置",
      writeRelease: "撰写版本更新",
      reviewQueue: "审核队列",
      release: "撰写版本更新",
      review: "审核队列",
      privateDemo: "私有工作区",
      demoWorkspaceName: "反馈工作区",
      demoWorkspaceDescription:
        "一个用于提交想法、跟进进展和查看后续结果的私有空间。",
      demoExpiryNotice: "工作区将在创建 24 小时后过期，请勿添加敏感信息。",
      expires: "工作区将在创建 24 小时后过期，请勿添加敏感信息。",
      viewingAs: "当前身份",
      member: "成员",
      moderator: "管理员",
      tryModeratorView: "试用管理员视图",
      returnToMemberView: "返回成员视图",
      changingView: "正在切换…",
      footer: "让想法与后续决策清晰可见。",
    },
    home: {
      preview: "私有工作区",
      title: "产品反馈，一处查看。",
      ready: "就绪",
      description:
        "让反馈公开可见，分享建议、找到相关想法，并了解每条反馈当前的进展。",
      noAccount: "无需账号，完整体验 24 小时。",
      metricsLabel: "你可以体验的内容",
      metricDemo: "有效期",
      metricStates: "状态阶段",
      metricWorkspace: "空间",
      workflow: "工作流程",
      step1Title: "找到讨论",
      step1Body: "按看板、标签或状态浏览，先搜索相关想法再提交新的反馈。",
      step2Title: "补充背景",
      step2Body: "描述问题与期望结果，成员提交的反馈会先进入审核。",
      step3Title: "保持状态透明",
      step3Body: "每条想法都有清晰状态，从审核中到已完成一目了然。",
      footer: "在一个私有工作区中提交反馈、讨论想法并跟进决定。",
    },
    status: {
      new: "新反馈",
      reviewing: "审核中",
      planned: "已计划",
      inProgress: "进行中",
      completed: "已完成",
      declined: "已拒绝",
      closed: "已关闭",
    },
    demo: {
      start: "开始体验",
      creating: "正在准备空间…",
      ready: "你的反馈空间已准备好。",
      openBoard: "打开反馈空间",
      requestLimit: "请求过多，请几分钟后再试。",
      requestLimitWait: (seconds) => `请求过多，请等待 ${seconds} 秒后再试。`,
      createFailed: "无法创建反馈空间，请检查网络后重试。",
    },
  },
};

export function getMessages(locale: Locale): I18nMessages {
  return messages[locale];
}

export function t(locale: Locale): I18nMessages {
  return getMessages(locale);
}
