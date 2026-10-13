/**
 * 浏览器半文案字典。
 * 注册进 ctx.locale 后，slot 条目上的 locale: 'greetTool' 会把 t() 绑到这里。
 */

export type GreetToolLocaleKey =
  | 'summary'
  | 'formAria'
  | 'greeting'
  | 'greetingHint'
  | 'preDeny'
  | 'preDenyHint'
  | 'postBlock'
  | 'postBlockHint'
  | 'save'
  | 'saving'
  | 'unavailable'
  | 'listHint'

export const zh: Record<GreetToolLocaleKey, string> = {
  summary: '问候前缀与门禁名单',
  formAria: 'greet 工具配置',
  greeting: '问候前缀',
  greetingHint: 'execute 返回的前缀，例如 Hey →「Hey, Ada!」',
  preDeny: '执行前拒绝名单',
  preDenyHint: '逗号分隔。名单内的 name 在 pre-execute 被 deny，不跑 execute。',
  postBlock: '执行后拦截名单',
  postBlockHint: '逗号分隔。先跑完 execute，再在 post-execute 改成错误反馈。勿与上一栏重叠。',
  save: '保存',
  saving: '保存中…',
  unavailable: 'Host 尚未提供本行的可编辑配置（字段需 .volatile()）。',
  listHint: '每行一个名字，或用英文逗号分隔。',
}

export const en: Record<GreetToolLocaleKey, string> = {
  summary: 'Greeting prefix and gate lists',
  formAria: 'greet tool configuration',
  greeting: 'Greeting prefix',
  greetingHint: 'Prefix for execute, e.g. Hey → "Hey, Ada!"',
  preDeny: 'Pre-execute deny list',
  preDenyHint: 'Comma-separated. Names here are denied before execute runs.',
  postBlock: 'Post-execute block list',
  postBlockHint: 'Comma-separated. execute runs first, then post-execute turns success into an error. Do not overlap the deny list.',
  save: 'Save',
  saving: 'Saving…',
  unavailable: 'Host is not serving an editable form for this row (fields need .volatile()).',
  listHint: 'One name per line, or comma-separated.',
}
