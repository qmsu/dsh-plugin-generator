// 「制作插件」页面的浏览器半区。
// dsh 客户端插件格式：window.__ModuleLoader__.load({ id, factory(require) })。
// react / slots / layout / locale / uiWorkspace / sessions 由宿主模块表提供，无需打包进本文件。
window.__ModuleLoader__.load({
  id: 'dsh-plugin-generator',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    var react = require('react')

    var PANEL_ID = 'plugin-scaffold'
    var NS = 'plugin-scaffold'

    var zh = {
      panel: '制作插件',
      title: '一句话制作 dsh 插件',
      intro: '描述你想要的插件，AI 会在新会话里把它做出来。参考文件可在此拖入或到制作会话里追加。',
      placeholder: '例：做一个把 Excel 批量转 Markdown 的插件，支持指定输出目录',
      refLabel: '参考文件（可选，可多选；文本类会读取内容一并发送）',
      refChoose: '选择文件…',
      refNone: '未选择',
      refRemove: '移除',
      refCount: '个文件',
      refHint: '二进制文件（xlsx/docx/图片）请在制作会话里拖入，模型自行解析。',
      dirLabel: '插件存放目录',
      dirPick: '选择目录…',
      dirPicking: '正在打开选择器…',
      dirSaved: '已保存',
      dirFailed: '保存失败：',
      makeLabel: '描述需求',
      typeLabel: '插件类型',
      typeAuto: '自动判断',
      typeTool: '工具',
      typeEvents: '事件',
      typeFile: '文件',
      typeToolkit: '能力套件',
      typeDescAuto: '由 AI 根据你的描述自行判断最合适的形态（推荐）',
      typeDescTool: '给 AI 加一个可调用的能力，如"转换 Excel"、"查询库存"',
      typeDescEvents: '在会话过程中自动做事，如"每轮结束导出记录"',
      typeDescFile: '读写处理文件（Excel / PDF / Word / CSV）',
      typeDescToolkit: '把多个 MCP server + 编排 skill 打成一个可安装的插件（一键装一整套）',
      submit: '生成插件',
      submitting: '正在创建制作会话…',
      done: '已创建制作会话，请到左侧会话列表打开「制作插件：…」查看生成过程。',
      failed: '创建失败：',
      searching: '已创建，正在定位会话…',
      locateFailed: '未能自动定位新会话，请到左侧会话列表打开「制作插件：…」查看。',
      jump: '跳转到会话',
      polling: '生成中…',
      listTitle: '我的插件',
      listEmpty: '这个目录下还没有插件。生成后插件会出现在这里。',
      listRefresh: '刷新',
      listCount: '个插件',
      installProfile: '装到 / 复制命令的 profile：',
      installCopy: '复制安装命令',
      copied: '已复制',
      invalidBadge: '不完整',
      stNotInstalled: '未安装',
      stEnabled: '已启用',
      stDisabled: '已禁用',
      stInactive: '未激活',
      actInstall: '安装',
      actPrechecking: '预检中…',
      precheckFail: '预检未通过：',
      actRemove: '卸载',
      confirmRemove: '确定要从当前 profile 卸载该插件吗？',
      actEnable: '启用',
      actDisable: '禁用',
      actUpdate: '更新',
      actRetry: '重试激活',
      actExport: '导出',
      exporting: '打包中…',
      exported: '已导出并开始下载',
      exportFail: '导出失败：',
      actBusy: '处理中…',
      actCapture: '把截止到这条回复的成果固化成插件',
      opDone: '操作已完成',
      opNeedRestart: '已保存，重启 profile 后生效',
      opFailed: '操作失败：',
    }
    var en = {
      panel: 'Plugin Maker',
      title: 'Make a dsh plugin in one sentence',
      intro: 'Describe the plugin you want and the AI builds it in a new session. Attach reference files here or in that session.',
      placeholder: 'e.g. batch-convert Excel files to Markdown with an output directory option',
      refLabel: 'Reference files (optional, multiple allowed; text files are read and sent)',
      refChoose: 'Choose…',
      refNone: 'None',
      refRemove: 'Remove',
      refCount: 'files',
      refHint: 'Binary files (xlsx/docx/images) should be dropped into the build session instead.',
      dirLabel: 'Plugin output directory',
      dirPick: 'Choose…',
      dirPicking: 'Opening chooser…',
      dirSaved: 'Saved',
      dirFailed: 'Save failed: ',
      makeLabel: 'Describe your plugin',
      typeLabel: 'Plugin type',
      typeAuto: 'Auto',
      typeTool: 'Tool',
      typeEvents: 'Events',
      typeFile: 'File',
      typeToolkit: 'Toolkit',
      typeDescAuto: 'The AI picks the most suitable form from your description (recommended)',
      typeDescTool: 'A capability the AI can call, e.g. “convert Excel”',
      typeDescEvents: 'Acts automatically during sessions, e.g. “export notes after each turn”',
      typeDescFile: 'Read/write files (Excel / PDF / Word / CSV)',
      typeDescToolkit: 'Bundle several MCP servers plus an orchestration skill into one installable plugin',
      submit: 'Generate',
      submitting: 'Creating session…',
      done: 'Session created. Open “Plugin Maker: …” in the session list to watch it build.',
      failed: 'Failed: ',
      searching: 'Created — locating the session…',
      locateFailed: 'Could not locate the new session automatically — open “Plugin Maker: …” from the session list.',
      jump: 'Open session',
      polling: 'Building…',
      listTitle: 'My plugins',
      listEmpty: 'No plugins in this directory yet. Generated ones will show up here.',
      listRefresh: 'Refresh',
      listCount: 'plugins',
      installProfile: 'Profile for install copy:',
      installCopy: 'Copy install command',
      copied: 'Copied',
      invalidBadge: 'incomplete',
      stNotInstalled: 'Not installed',
      stEnabled: 'Enabled',
      stDisabled: 'Disabled',
      stInactive: 'Inactive',
      actInstall: 'Install',
      actPrechecking: 'Checking…',
      precheckFail: 'Precheck failed: ',
      actRemove: 'Remove',
      confirmRemove: 'Remove this plugin from the current profile?',
      actEnable: 'Enable',
      actDisable: 'Disable',
      actUpdate: 'Update',
      actRetry: 'Re-activate',
      actExport: 'Export',
      exporting: 'Packaging…',
      exported: 'Exported — download started',
      exportFail: 'Export failed: ',
      actBusy: 'Working…',
      actCapture: 'Turn the result up to this reply into a plugin',
      opDone: 'Done',
      opNeedRestart: 'Saved — restart the profile to take effect',
      opFailed: 'Failed: ',
    }

    var inject = ['slots', 'locale', 'uiWorkspace', 'sessions']

    // 页面样式：注入一次 <style>（类名 psc- 前缀，避免污染宿主）
    function injectStyles() {
      if (typeof document === 'undefined' || document.getElementById('psc-style')) return
      var css = [
        // 配色全部走宿主设计系统 token（与插件管理器页面同款），仅留回退值
        '.psc-wrap{max-width:760px;margin:0 auto;padding:28px 24px 60px;font-size:14px;line-height:1.65;color:var(--dsw-alias-label-primary,inherit)}',
        '.psc-hero{display:flex;gap:16px;align-items:center;margin-bottom:30px}',
        '.psc-heroIcon{width:50px;height:50px;border-radius:var(--dsw-radius-md,14px);flex:none;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,var(--dsw-alias-brand-primary,#4176e6),#8b5cf6);box-shadow:0 8px 22px color-mix(in srgb,var(--dsw-alias-brand-primary,#4176e6) 35%,transparent)}',
        '.psc-title{font-size:22px;font-weight:700;margin:0;letter-spacing:.2px}',
        '.psc-intro{color:var(--dsw-alias-label-secondary,#8a8f98);margin:5px 0 0;font-size:13.5px}',
        '.psc-card{background:var(--dsw-alias-bg-layer-1,rgba(128,128,128,.06));border:.5px solid var(--dsw-alias-border-l1,rgba(128,128,128,.18));border-radius:var(--dsw-radius-lg,16px);padding:20px 22px;margin-bottom:16px}',
        '.psc-cardTitle{display:flex;align-items:center;gap:8px;margin:0 0 14px;font-size:12.5px;font-weight:600;letter-spacing:.7px;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#9aa0a8)}',
        '.psc-dirRow{display:flex;align-items:center;gap:10px}',
        '.psc-dirPath{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ds-font-family-code,ui-monospace,Menlo,monospace);font-size:12.5px;padding:9px 13px;border-radius:var(--dsw-radius-sm,10px);background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.09));border:.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.15));color:var(--dsw-alias-label-secondary,#8a8f98)}',
        '.psc-textarea{width:100%;min-height:96px;padding:12px 14px;resize:vertical;box-sizing:border-box;color:inherit;background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.05));border:.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.2));border-radius:var(--dsw-radius-md,12px);font:inherit;transition:border-color .15s,box-shadow .15s}',
        '.psc-textarea:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#4176e6);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary,#4176e6) 18%,transparent)}',
        '.psc-textarea::placeholder{color:var(--dsw-alias-label-tertiary,#9aa0a8)}',
        '.psc-refRow{display:flex;align-items:center;gap:10px;margin-top:12px}',
        '.psc-refName{flex:1;font-size:12.5px;color:var(--dsw-alias-label-secondary,#8a8f98);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.psc-refHint{font-size:11.5px;color:var(--dsw-alias-label-tertiary,#9aa0a8);margin-top:6px}',
        '.psc-refChips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}',
        '.psc-chip{display:inline-flex;align-items:center;gap:6px;padding:3px 6px 3px 10px;border-radius:999px;font-size:12px;background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.09));border:.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.2));color:var(--dsw-alias-label-secondary,#8a8f98)}',
        '.psc-chipName{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.psc-chipX{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;border:none;cursor:pointer;padding:0;background:transparent;color:var(--dsw-alias-label-tertiary,#9aa0a8);transition:all .12s}',
        '.psc-chipX:hover{background:var(--dsw-alias-state-error-primary,#d9534f);color:#fff}',
        '.psc-pills{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 8px}',
        '.psc-pill{padding:7px 16px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.28));cursor:pointer;font:inherit;font-size:13px;background:transparent;color:var(--dsw-alias-label-secondary,#8a8f98);transition:all .15s}',
        '.psc-pill:hover{border-color:var(--dsw-alias-brand-primary,#4176e6);color:var(--dsw-alias-brand-primary,#4176e6)}',
        '.psc-pill.psc-active{background:var(--dsw-alias-brand-primary,#4176e6);border-color:transparent;color:#fff;font-weight:600}',
        '.psc-pillDesc{font-size:12.5px;color:var(--dsw-alias-label-secondary,#8a8f98);margin:2px 2px 14px;min-height:1.2em}',
        '.psc-actions{display:flex;justify-content:flex-end}',
        '.psc-btn{display:inline-flex;align-items:center;gap:7px;padding:9px 20px;border-radius:var(--dsw-radius-sm,10px);border:.5px solid transparent;cursor:pointer;font:inherit;font-size:13.5px;font-weight:600;transition:all .15s}',
        '.psc-btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important;box-shadow:none!important}',
        '.psc-btn-primary{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#4176e6));color:#fff}',
        '.psc-btn-primary:not(:disabled):hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary,#4176e6));transform:translateY(-1px);box-shadow:0 6px 18px color-mix(in srgb,var(--dsw-alias-brand-primary,#4176e6) 35%,transparent)}',
        '.psc-btn-ghost{background:transparent;color:var(--dsw-alias-label-secondary,#8a8f98);border-color:var(--dsw-alias-border-l2,rgba(128,128,128,.28));box-shadow:none;padding:8px 14px;font-weight:500}',
        '.psc-btn-ghost:hover{border-color:var(--dsw-alias-brand-primary,#4176e6);color:var(--dsw-alias-brand-primary,#4176e6)}',
        '.psc-msg{margin-top:13px;font-size:13px;display:flex;gap:7px;align-items:center}',
        '.psc-msg-ok{color:var(--dsw-alias-state-success-primary,#3aa76d)}',
        '.psc-msg-err{color:var(--dsw-alias-state-error-primary,#d9534f)}',
        '.psc-listHead{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
        '.psc-listTitle{flex:1;margin:0;display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;letter-spacing:.7px;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#9aa0a8)}',
        '.psc-listCount{font-size:12px;color:var(--dsw-alias-label-tertiary,#9aa0a8)}',
        '.psc-profile{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f98)}',
        '.psc-select{padding:5px 8px;color:inherit;background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.08));border:.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.2));border-radius:8px;font:inherit;font-size:12px}',
        '.psc-plugin{display:flex;align-items:center;gap:12px;padding:12px 10px;border-radius:var(--dsw-radius-md,12px);transition:background .15s}',
        '.psc-plugin:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.08))}',
        '.psc-plugin + .psc-plugin{border-top:.5px solid var(--dsw-alias-border-l1,rgba(128,128,128,.12))}',
        '.psc-pluginIcon{width:32px;height:32px;border-radius:var(--dsw-radius-sm,9px);flex:none;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4176e6) 12%,transparent);color:var(--dsw-alias-brand-primary,#4176e6)}',
        '.psc-pluginMain{flex:1;min-width:0}',
        '.psc-pluginName{font-weight:600;font-size:13.5px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
        '.psc-pluginName code{font-family:var(--ds-font-family-code,ui-monospace,Menlo,monospace);font-size:12px;color:var(--dsw-alias-label-tertiary,#9aa0a8);font-weight:400}',
        '.psc-pluginMeta{font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f98);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.psc-st{font-size:11px;padding:1px 8px;border-radius:999px;flex:none;border:.5px solid transparent}',
        '.psc-st-on{color:var(--dsw-alias-state-success-primary,#3aa76d);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3aa76d) 10%,transparent)}',
        '.psc-st-off{color:var(--dsw-alias-state-warn-primary,#d97706);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d97706) 10%,transparent)}',
        '.psc-st-err{color:var(--dsw-alias-state-error-primary,#d9534f);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d9534f) 10%,transparent)}',
        '.psc-st-none{color:var(--dsw-alias-label-tertiary,#9aa0a8);background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.1))}',
        '.psc-btn-sm{padding:6px 13px;font-size:12.5px;border-radius:9px}',
        '.psc-rowActions{display:flex;gap:8px;flex:none;align-items:center;flex-wrap:wrap}',
        '.psc-btn-danger:hover{border-color:var(--dsw-alias-state-error-primary,#d9534f)!important;color:var(--dsw-alias-state-error-primary,#d9534f)!important}',
        '.psc-badge{font-size:11px;padding:1px 8px;border-radius:999px;flex:none;color:var(--dsw-alias-state-error-primary,#d9534f);border:.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#d9534f) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d9534f) 8%,transparent)}',
        '.psc-empty{padding:26px 0 10px;text-align:center;color:var(--dsw-alias-label-tertiary,#9aa0a8);font-size:13px}',
        '.psc-progress{margin-top:13px;font-size:13px;display:flex;gap:10px;align-items:center}',
        // 会话窗口 assistant 操作条上的「固化为插件」小按钮
        '.psc-actBtn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary,#9aa0a8);cursor:pointer;transition:all .12s}',
        '.psc-actBtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.1));color:var(--dsw-alias-label-secondary,#8a8f98)}',
        '.psc-actBtn:disabled{opacity:.45;cursor:default}',
      ].join('\n')
      var style = document.createElement('style')
      style.id = 'psc-style'
      style.textContent = css
      document.head.appendChild(style)
    }

    // 侧边栏图标：宿主负责按钮与标签，这里只出字形（扳手）
    function ScaffoldIcon(props) {
      var size = props.size || 20
      return react.createElement('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: '1.6', strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true,
      },
        react.createElement('path', { d: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6z' }),
      )
    }
    function FolderIcon() {
      return react.createElement('svg', { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.7', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        react.createElement('path', { d: 'M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z' }),
      )
    }
    function SparkIcon() {
      return react.createElement('svg', { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.7', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        react.createElement('path', { d: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z' }),
        react.createElement('path', { d: 'M19 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z' }),
      )
    }
    function GridIcon() {
      return react.createElement('svg', { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.7', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        react.createElement('rect', { x: 4, y: 4, width: 7, height: 7, rx: 1.5 }),
        react.createElement('rect', { x: 13, y: 4, width: 7, height: 7, rx: 1.5 }),
        react.createElement('rect', { x: 4, y: 13, width: 7, height: 7, rx: 1.5 }),
        react.createElement('rect', { x: 13, y: 13, width: 7, height: 7, rx: 1.5 }),
      )
    }
    function BoxIcon() {
      return react.createElement('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.7', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        react.createElement('path', { d: 'M12 3l8 4.2v9.6L12 21l-8-4.2V7.2L12 3z' }),
        react.createElement('path', { d: 'M4 7.2l8 4.2 8-4.2M12 11.4V21' }),
      )
    }
    function CheckIcon() {
      return react.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2.2', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        react.createElement('path', { d: 'M4.5 12.5l5 5L19.5 7' }),
      )
    }

    // 主页面：目录设置 + 需求生成（含参考文件）+ 自制插件列表（状态 + 操作）
    // props.close 由设置页宿主注入（renderSlot("settings.section", { close })），跳转会话时关闭设置面板
    function createPageComponent(t, request, host) {
      return function ScaffoldPageComponent(props) {
        var s1 = react.useState({ text: '', type: 'auto', busy: false, message: null, error: false, refFiles: [], progress: null })
        var form = s1[0]
        var setForm = s1[1]
        var s2 = react.useState({ dir: '', picking: false, dirMessage: null, dirError: false, plugins: [], loaded: false, opMessage: null, opError: false, profiles: [], profile: '' })
        var list = s2[0]
        var setList = s2[1]

        var updateForm = function (patch) { setForm(function (v) { return Object.assign({}, v, patch) }) }
        var updateList = function (patch) { setList(function (v) { return Object.assign({}, v, patch) }) }

        // 跳转到目标会话并关闭设置面板（自动跳转与手动按钮共用）
        var jumpToSession = function (sessionId) {
          if (!sessionId || !host.openSession) return
          try { host.openSession(sessionId) } catch (e) {}
          if (props && typeof props.close === 'function') { try { props.close() } catch (e) {} }
        }

        var loadPlugins = function () {
          request('GET', '/plugin-scaffold/list').then(function (res) {
            if (res.ok) updateList({ plugins: res.body.plugins || [], loaded: true })
          }).catch(function () { updateList({ loaded: true }) })
        }

        // 初次加载：读设置 + 插件列表 + profile 列表
        react.useEffect(function () {
          request('GET', '/plugin-scaffold/settings').then(function (res) {
            if (res.ok) updateList({ dir: res.body.outputDir })
          }).catch(function () {}).then(loadPlugins)
          request('GET', '/plugin-scaffold/profiles').then(function (res) {
            if (res.ok) {
              updateList({ profiles: res.body.all || [], profile: res.body.current || '' })
            }
          }).catch(function () {})
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [])

        // 弹出系统目录选择器；选定后自动保存并刷新插件列表
        var onPickDir = function () {
          if (list.picking || !host.pickDirectory) return
          updateList({ picking: true, dirMessage: null })
          host.pickDirectory().then(function (path) {
            if (!path) { updateList({ picking: false }); return }
            request('POST', '/plugin-scaffold/settings', { outputDir: path }).then(function (res) {
              if (res.ok && res.body.ok) {
                updateList({ picking: false, dir: res.body.outputDir, dirMessage: t('dirSaved'), dirError: false })
                loadPlugins()
              } else {
                updateList({ picking: false, dirMessage: t('dirFailed') + (res.body.error || res.status), dirError: true })
              }
            }).catch(function (err) {
              updateList({ picking: false, dirMessage: t('dirFailed') + String(err), dirError: true })
            })
          }).catch(function (err) {
            updateList({ picking: false, dirMessage: t('dirFailed') + String(err && err.message || err), dirError: true })
          })
        }

        // 参考文件：多选，逐个读取文本内容随需求一起发送；二进制交给会话
        var onChooseRef = function (e) {
          var files = Array.prototype.slice.call(e.target.files || [])
          e.target.value = ''
          if (!files.length) return
          var readers = files.map(function (file) {
            return new Promise(function (resolve) {
              var reader = new FileReader()
              reader.onload = function () { resolve({ name: file.name, text: String(reader.result || '').slice(0, 8000) }) }
              reader.onerror = function () { resolve({ name: file.name, text: '' }) }
              reader.readAsText(file)
            })
          })
          Promise.all(readers).then(function (items) {
            setForm(function (v) {
              // 同名文件视为替换，其余追加
              var kept = v.refFiles.filter(function (f) {
                return !items.some(function (it) { return it.name === f.name })
              })
              return Object.assign({}, v, { refFiles: kept.concat(items) })
            })
          })
        }

        // 叉掉选错的参考文件
        var onRemoveRef = function (name) {
          setForm(function (v) {
            return Object.assign({}, v, { refFiles: v.refFiles.filter(function (f) { return f.name !== name }) })
          })
        }

        // 汇总参考文件文本（每个文件带文件名头），总量封顶 60K 字符
        var buildReferenceText = function () {
          var parts = []
          var total = 0
          for (var i = 0; i < form.refFiles.length; i++) {
            var f = form.refFiles[i]
            var part = '===== ' + f.name + ' =====\n' + f.text
            if (total + part.length > 60000) break
            parts.push(part)
            total += part.length
          }
          return parts.join('\n\n')
        }

        // 生成：记录改动前的会话 id 集合，用于定位新建的会话
        var onSubmit = function () {
          if (!form.text.trim() || form.busy) return
          var prior = new Set()
          if (host.sessions) {
            try { host.sessions.list.getSnapshot().ids.forEach(function (id) { prior.add(id) }) } catch (e) {}
          }
          updateForm({ busy: true, message: null, error: false, progress: null })
          request('POST', '/plugin-scaffold/make', {
            requirement: form.text, templateHint: form.type, referenceText: buildReferenceText(),
          }).then(function (res) {
            if (res.ok && res.body.ok) {
              updateForm({ busy: false, text: '', refFiles: [], message: null, progress: { sessionId: null, title: form.text.slice(0, 30), running: true } })
              pollCreated(prior)
            } else {
              updateForm({ busy: false, message: t('failed') + (res.body.error || res.status), error: true })
            }
          }).catch(function (err) {
            updateForm({ busy: false, message: t('failed') + String(err), error: true })
          })
        }

        // 轮询定位新建会话：标题含「制作插件」且不在 prior 里的第一个
        var pollCreated = function (prior) {
          if (!host.sessions) return
          var attempts = 0
          var timer = setInterval(function () {
            attempts++
            host.sessions.refresh().then(function () {
              var snap = host.sessions.list.getSnapshot()
              var found = null
              for (var i = 0; i < snap.ids.length; i++) {
                var id = snap.ids[i]
                var s = snap.byId[id]
                if (!s) continue
                if (prior.has(id)) continue
                if ((s.displayTitle || '').indexOf('制作插件') >= 0 || (s.displayTitle || '').indexOf('Plugin Maker') >= 0) {
                  found = { sessionId: id, title: s.displayTitle, running: !!s.running }
                  break
                }
              }
              if (found) {
                clearInterval(timer)
                updateForm({ progress: found })
                jumpToSession(found.sessionId)
              } else if (attempts >= 15) {
                clearInterval(timer)
                updateForm({ progress: { sessionId: null, title: null, running: false, failed: true } })
              }
            }).catch(function () {
              if (attempts >= 15) { clearInterval(timer); updateForm({ progress: { sessionId: null, title: null, running: false, failed: true } }) }
            })
          }, 2000)
        }

        var onJump = function () {
          if (form.progress && form.progress.sessionId) jumpToSession(form.progress.sessionId)
        }

        var onCopyInstall = function (plugin) {
          var profile = list.profile || '<profile>'
          var cmd = 'dsh plugin --profile ' + profile + ' add ' + plugin.path
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(cmd).then(function () {
              plugin._copied = true
              updateList({ plugins: list.plugins.slice() })
              setTimeout(function () {
                plugin._copied = false
                updateList({ plugins: list.plugins.slice() })
              }, 1500)
            }).catch(function () {})
          }
        }

        // 安装前预检：把 schema/依赖错误拦在 pnpm 之前
        var precheck = function (path) {
          return request('POST', '/plugin-scaffold/check', { path: path })
        }

        // 安装（含预检）/ 卸载 / 启用 / 禁用 / 更新；完成后刷新列表
        var onPluginAction = function (plugin, action) {
          if (plugin._busy) return
          if (action === 'remove' && !window.confirm(t('confirmRemove'))) return
          var run = function () {
            var req
            if (action === 'install') req = request('POST', '/plugin-scaffold/install', { path: plugin.path })
            else if (action === 'remove') req = request('POST', '/plugin-scaffold/remove', { name: plugin.name })
            else if (action === 'update') req = request('POST', '/plugin-scaffold/update', { path: plugin.path })
            else req = request('POST', '/plugin-scaffold/set-enabled', { entryId: plugin.status && plugin.status.entryId, enabled: action === 'enable' })
            req.then(function (res) {
              if (res.ok && res.body.ok) {
                updateList({ opMessage: res.body.application === 'restart-required' ? t('opNeedRestart') : t('opDone'), opError: false })
              } else {
                updateList({ opMessage: t('opFailed') + (res.body.diagnostic || res.body.error || res.status), opError: true })
              }
              loadPlugins()
            }).catch(function (err) {
              updateList({ opMessage: t('opFailed') + String(err), opError: true })
              loadPlugins()
            })
          }
          plugin._busy = true
          updateList({ opMessage: null, plugins: list.plugins.slice() })
          if (action === 'install') {
            precheck(plugin.path).then(function (chk) {
              if (!chk.ok) {
                plugin._busy = false
                updateList({ opMessage: t('precheckFail') + (chk.body && chk.body.error || chk.status), opError: true, plugins: list.plugins.slice() })
                return
              }
              run()
            }).catch(function (err) {
              plugin._busy = false
              updateList({ opMessage: t('precheckFail') + String(err), opError: true, plugins: list.plugins.slice() })
            })
          } else {
            run()
          }
        }

        // 导出 zip 并触发下载
        var onExport = function (plugin) {
          if (plugin._busy) return
          plugin._busy = true
          updateList({ opMessage: null, plugins: list.plugins.slice() })
          request('POST', '/plugin-scaffold/export', { path: plugin.path }).then(function (res) {
            if (res.ok && res.body.ok) {
              var zipPath = res.body.zipPath
              return fetch('/plugin-scaffold/download?file=' + encodeURIComponent(zipPath), {
                headers: { 'x-plugin-scaffold-token': window.__PLUGIN_SCAFFOLD_TOKEN__ || '' },
              }).then(function (r) {
                if (!r.ok) throw new Error('download ' + r.status)
                return r.blob()
              }).then(function (blob) {
                var a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = zipPath.split('/').pop()
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(a.href)
                plugin._busy = false
                updateList({ opMessage: t('exported'), opError: false, plugins: list.plugins.slice() })
              })
            }
            plugin._busy = false
            updateList({ opMessage: t('exportFail') + (res.body.error || res.status), opError: true, plugins: list.plugins.slice() })
          }).catch(function (err) {
            plugin._busy = false
            updateList({ opMessage: t('exportFail') + String(err), opError: true, plugins: list.plugins.slice() })
          })
        }

        var typeOptions = [
          { value: 'auto', label: t('typeAuto'), desc: t('typeDescAuto') },
          { value: 'tool', label: t('typeTool'), desc: t('typeDescTool') },
          { value: 'events', label: t('typeEvents'), desc: t('typeDescEvents') },
          { value: 'file', label: t('typeFile'), desc: t('typeDescFile') },
          { value: 'toolkit', label: t('typeToolkit'), desc: t('typeDescToolkit') },
        ]
        var activeType = typeOptions.filter(function (o) { return o.value === form.type })[0] || typeOptions[0]

        return react.createElement('div', { className: 'psc-wrap' },

          // ── 头部 ──
          react.createElement('div', { className: 'psc-hero' },
            react.createElement('div', { className: 'psc-heroIcon' }, react.createElement(ScaffoldIcon, { size: 26 })),
            react.createElement('div', null,
              react.createElement('h2', { className: 'psc-title' }, t('title')),
              react.createElement('p', { className: 'psc-intro' }, t('intro')),
            ),
          ),

          // ── 目录设置 ──
          react.createElement('div', { className: 'psc-card' },
            react.createElement('h3', { className: 'psc-cardTitle' }, react.createElement(FolderIcon, null), t('dirLabel')),
            react.createElement('div', { className: 'psc-dirRow' },
              react.createElement('span', { className: 'psc-dirPath', title: list.dir }, list.dir || '—'),
              react.createElement('button', { className: 'psc-btn psc-btn-ghost', onClick: onPickDir, disabled: list.picking },
                list.picking ? t('dirPicking') : t('dirPick')),
            ),
            list.dirMessage ? react.createElement('div', { className: 'psc-msg ' + (list.dirError ? 'psc-msg-err' : 'psc-msg-ok') }, list.dirMessage) : null,
          ),

          // ── 需求生成 ──
          react.createElement('div', { className: 'psc-card' },
            react.createElement('h3', { className: 'psc-cardTitle' }, react.createElement(SparkIcon, null), t('makeLabel')),
            react.createElement('textarea', {
              className: 'psc-textarea',
              placeholder: t('placeholder'),
              value: form.text,
              onChange: function (e) { updateForm({ text: e.target.value }) },
            }),
            react.createElement('div', { className: 'psc-refRow' },
              react.createElement('span', { className: 'psc-refName' }, t('refLabel') + '　' + (form.refFiles.length ? form.refFiles.length + ' ' + t('refCount') : t('refNone'))),
              react.createElement('label', { className: 'psc-btn psc-btn-ghost psc-btn-sm' },
                t('refChoose'),
                react.createElement('input', { type: 'file', multiple: true, style: { display: 'none' }, onChange: onChooseRef }),
              ),
            ),
            form.refFiles.length
              ? react.createElement('div', { className: 'psc-refChips' },
                  form.refFiles.map(function (f) {
                    return react.createElement('span', { key: f.name, className: 'psc-chip', title: f.name },
                      react.createElement('span', { className: 'psc-chipName' }, f.name),
                      react.createElement('button', {
                        className: 'psc-chipX',
                        title: t('refRemove'),
                        onClick: function () { onRemoveRef(f.name) },
                      }, '✕'),
                    )
                  }),
                )
              : null,
            react.createElement('div', { className: 'psc-refHint' }, t('refHint')),
            react.createElement('div', { className: 'psc-pills' },
              typeOptions.map(function (o) {
                return react.createElement('button', {
                  key: o.value,
                  className: 'psc-pill' + (form.type === o.value ? ' psc-active' : ''),
                  onClick: function () { updateForm({ type: o.value }) },
                }, o.label)
              }),
            ),
            react.createElement('div', { className: 'psc-pillDesc' }, activeType.desc),
            react.createElement('div', { className: 'psc-actions' },
              react.createElement('button', {
                className: 'psc-btn psc-btn-primary',
                onClick: onSubmit,
                disabled: form.busy || !form.text.trim(),
              }, form.busy ? t('submitting') : t('submit')),
            ),
            form.progress ? react.createElement('div', { className: 'psc-progress' },
              react.createElement('span', { className: form.progress.sessionId ? 'psc-msg-ok' : 'psc-msg-err' },
                form.progress.sessionId ? (form.progress.running ? t('polling') : t('done')) : (form.progress.failed ? t('locateFailed') : t('searching'))),
              form.progress.sessionId ? react.createElement('button', { className: 'psc-btn psc-btn-ghost psc-btn-sm', onClick: onJump }, t('jump')) : null,
            ) : null,
            form.message ? react.createElement('div', { className: 'psc-msg ' + (form.error ? 'psc-msg-err' : 'psc-msg-ok') },
              !form.error ? react.createElement(CheckIcon, null) : null, form.message) : null,
          ),

          // ── 插件列表 ──
          react.createElement('div', { className: 'psc-card' },
            react.createElement('div', { className: 'psc-listHead' },
              react.createElement('h3', { className: 'psc-listTitle' }, react.createElement(GridIcon, null), t('listTitle')),
              list.loaded && list.plugins.length > 0
                ? react.createElement('span', { className: 'psc-listCount' }, list.plugins.length + ' ' + t('listCount')) : null,
              list.profiles.length > 1
                ? react.createElement('span', { className: 'psc-profile' },
                    t('installProfile'),
                    react.createElement('select', {
                      className: 'psc-select',
                      value: list.profile,
                      onChange: function (e) { updateList({ profile: e.target.value }) },
                    }, list.profiles.map(function (p) { return react.createElement('option', { key: p, value: p }, p) })),
                  )
                : null,
              react.createElement('button', { className: 'psc-btn psc-btn-ghost psc-btn-sm', onClick: loadPlugins }, t('listRefresh')),
            ),
            list.opMessage ? react.createElement('div', { className: 'psc-msg ' + (list.opError ? 'psc-msg-err' : 'psc-msg-ok') }, list.opMessage) : null,
            list.loaded && list.plugins.length === 0
              ? react.createElement('div', { className: 'psc-empty' }, t('listEmpty'))
              : null,
            react.createElement('div', null, list.plugins.map(function (plugin) {
              var st = plugin.status
              var stBadge = !plugin.ok ? null : !st || !st.installed
                ? react.createElement('span', { className: 'psc-st psc-st-none' }, t('stNotInstalled'))
                : !st.enabled
                  ? react.createElement('span', { className: 'psc-st psc-st-off' }, t('stDisabled'))
                  : st.active
                    ? react.createElement('span', { className: 'psc-st psc-st-on' }, t('stEnabled'))
                    : react.createElement('span', { className: 'psc-st psc-st-err' }, t('stInactive'))
              var actions
              if (plugin._busy) {
                actions = react.createElement('button', { className: 'psc-btn psc-btn-ghost psc-btn-sm', disabled: true }, t('actBusy'))
              } else if (!st || !st.installed) {
                actions = react.createElement('span', { className: 'psc-rowActions' },
                  react.createElement('button', { className: 'psc-btn psc-btn-primary psc-btn-sm', onClick: function () { onPluginAction(plugin, 'install') } }, t('actInstall')),
                  react.createElement('button', { className: 'psc-btn psc-btn-ghost psc-btn-sm', onClick: function () { onCopyInstall(plugin) } }, plugin._copied ? t('copied') : t('installCopy')),
                )
              } else {
                var isInactive = st.enabled && !st.active
                actions = react.createElement('span', { className: 'psc-rowActions' },
                  isInactive
                    ? react.createElement('button', { className: 'psc-btn psc-btn-ghost psc-btn-sm', onClick: function () { onPluginAction(plugin, 'update') } }, t('actRetry'))
                    : react.createElement('button', { className: 'psc-btn psc-btn-ghost psc-btn-sm', onClick: function () { onPluginAction(plugin, st.enabled ? 'disable' : 'enable') } }, st.enabled ? t('actDisable') : t('actEnable')),
                  react.createElement('button', { className: 'psc-btn psc-btn-ghost psc-btn-sm', onClick: function () { onPluginAction(plugin, 'update') } }, t('actUpdate')),
                  react.createElement('button', { className: 'psc-btn psc-btn-ghost psc-btn-sm', onClick: function () { onExport(plugin) } }, t('actExport')),
                  react.createElement('button', { className: 'psc-btn psc-btn-ghost psc-btn-sm psc-btn-danger', onClick: function () { onPluginAction(plugin, 'remove') } }, t('actRemove')),
                )
              }
              return react.createElement('div', { key: plugin.id, className: 'psc-plugin', title: plugin.path },
                react.createElement('div', { className: 'psc-pluginIcon' }, react.createElement(BoxIcon, null)),
                react.createElement('div', { className: 'psc-pluginMain' },
                  react.createElement('div', { className: 'psc-pluginName' },
                    plugin.name, plugin.version ? react.createElement('code', null, '@' + plugin.version) : null,
                    stBadge,
                    !plugin.ok ? react.createElement('span', { className: 'psc-badge' }, t('invalidBadge')) : null),
                  react.createElement('div', { className: 'psc-pluginMeta' },
                    (plugin.description ? plugin.description + ' · ' : '') + plugin.path),
                ),
                actions,
              )
            })),
          ),
        )
      }
    }

    /**
     * 会话窗口入口：assistant 消息操作条（conversation.chat.assistant-actions，
     * 点赞/点踩旁边）上的「固化为插件」小按钮。
     * 点击即创建 capability 制作会话（要求第 1 步 capture 本会话），轮询定位后自动跳转。
     * captureSessionId 由 slot 的 inject(sessionId) 按会话注入。
     */
    function createCaptureAction(t, request, host) {
      return function CaptureAction(props) {
        var st = react.useState('idle')
        var state = st[0]
        var setState = st[1]

        var onCapture = function () {
          if (state !== 'idle') return
          var sessionId = String(props.captureSessionId || '')
          if (!sessionId) return
          // 固化范围：截止到点按钮的那条 assistant 回复（该消息及其之前的整段会话）
          var messageId = String(props.messageId || '')
          var prior = new Set()
          if (host.sessions) {
            try { host.sessions.list.getSnapshot().ids.forEach(function (id) { prior.add(id) }) } catch (e) {}
          }
          setState('working')
          var requirement = '基于会话 ' + sessionId + (messageId ? ' 截止到消息 ' + messageId : '') + ' 把已完成的能力固化成插件，目标：生成的插件在同类需求下能稳定复现源会话最终结果的同等质量与格式（以源会话最终结果为基准样本）。第 1 步必须调 scaffold_capture，sessionId 传 "' + sessionId + '"' +
            (messageId ? '、upToMessageId 传 "' + messageId + '"（只提取到该条回复为止的需求/结果/过程）' : '') +
            '；若返回 truncated=true，必须重跑并传更大 maxResultBytes（如 60000）直到拿到最终结果全文。然后按 capability 模板生成插件，三点硬性要求：' +
            '① assets/examples.json 必须收录「需求原文 → 最终结果完整原文」对照对，output 是 capture 拿到的最终结果的完整原文，禁止摘要/改写/缩水；' +
            '② assets/skill.md 必须把原始产出全文收进「原始标杆产出」一节作质量标杆，并写清可复现步骤与可机器检查的产出契约（checkContract 的规则要从原始产出提炼：必备章节/字段、长度下限、关键内容特征）；' +
            '③ 渲染结果必须与原始产出同构（原作是 HTML 就渲染 HTML，不得退化成 Markdown 摘要）。交付前用 examples 里的输入重放 validate→render 自验收，确认产出与原始结果同构。最后校验打包。'
          request('POST', '/plugin-scaffold/make', { requirement: requirement, templateHint: 'capability', referenceText: '' }).then(function (res) {
            if (!(res.ok && res.body.ok)) { setState('idle'); return }
            if (!host.sessions) { setState('done'); return }
            var attempts = 0
            var timer = setInterval(function () {
              attempts++
              host.sessions.refresh().then(function () {
                var snap = host.sessions.list.getSnapshot()
                var found = null
                for (var i = 0; i < snap.ids.length; i++) {
                  var id = snap.ids[i]
                  var s = snap.byId[id]
                  if (!s || prior.has(id)) continue
                  var title = s.displayTitle || ''
                  if (title.indexOf('制作插件') >= 0 || title.indexOf('Plugin Maker') >= 0) { found = id; break }
                }
                if (found) {
                  clearInterval(timer)
                  setState('done')
                  try { host.openSession(found) } catch (e) {}
                } else if (attempts >= 15) {
                  clearInterval(timer)
                  setState('idle')
                }
              }).catch(function () {
                if (attempts >= 15) { clearInterval(timer); setState('idle') }
              })
            }, 2000)
          }).catch(function () { setState('idle') })
        }

        return react.createElement('button', {
          className: 'psc-actBtn',
          title: t('actCapture'),
          'aria-label': t('actCapture'),
          disabled: state !== 'idle',
          onClick: onCapture,
        }, react.createElement(BoxIcon, null))
      }
    }

    /** 带 CSRF token 的同源 JSON 请求。 */
    function createRequest() {
      return function request(method, path, body) {
        return fetch(path, {
          method: method,
          headers: {
            'content-type': 'application/json',
            'x-plugin-scaffold-token': window.__PLUGIN_SCAFFOLD_TOKEN__ || '',
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        }).then(function (res) {
          return res.json().then(function (parsed) {
            return { ok: res.ok, status: res.status, body: parsed }
          }).catch(function () {
            return { ok: res.ok, status: res.status, body: {} }
          })
        })
      }
    }

    /**
     * 设置页左侧导航的图标是宿主硬编码的 id→图标 映射（dsh-client-ui-settings-general
     * 的 navIcon()），未知 id 一律回退齿轮，插件无法注册自己的导航图标。
     * 这里监听 DOM，把本 section 那一行的齿轮换成扳手（React 重渲染后由
     * MutationObserver 自动补回）。
     */
    function patchSettingsNavIcon() {
      if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
      var LABELS = [zh.panel, en.panel]
      var NS = 'http://www.w3.org/2000/svg'
      var timer = null
      var makeWrench = function (cls) {
        var svg = document.createElementNS(NS, 'svg')
        svg.setAttribute('width', '16'); svg.setAttribute('height', '16')
        svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none')
        svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.7')
        svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round')
        svg.setAttribute('aria-hidden', 'true')
        svg.setAttribute('data-psc-wrench', '1')
        if (cls) svg.setAttribute('class', cls)
        var p = document.createElementNS(NS, 'path')
        p.setAttribute('d', 'M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6z')
        svg.appendChild(p)
        return svg
      }
      var scan = function () {
        timer = null
        var btns = document.querySelectorAll('nav button')
        for (var i = 0; i < btns.length; i++) {
          var b = btns[i]
          if (LABELS.indexOf((b.textContent || '').trim()) === -1) continue
          var svg = b.querySelector('svg')
          if (!svg || svg.getAttribute('data-psc-wrench')) continue
          b.replaceChild(makeWrench(svg.getAttribute('class')), svg)
        }
      }
      var schedule = function () { if (timer === null) timer = setTimeout(scan, 50) }
      var obs = new MutationObserver(schedule)
      obs.observe(document.body, { childList: true, subtree: true })
      schedule()
      return function () { obs.disconnect(); if (timer !== null) clearTimeout(timer) }
    }

    /**
     * 注册「制作插件」为设置页的一个顶层 section（照官方 settings-general 的模式，
     * 与 通用/模型/插件 并列；children/inject 均可选）。
     */
    function apply(ctx) {
      injectStyles()
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'plugin-scaffold: dictionaries')
      ctx.effect(() => patchSettingsNavIcon(), 'plugin-scaffold: nav wrench icon')
      var t = ctx.locale.bind(NS)

      var host = {
        pickDirectory: function () { return ctx.uiWorkspace.pickDirectory() },
        openSession: function (id) { return ctx.uiWorkspace.openSession(id) },
        sessions: ctx.get('sessions') || null,
      }
      var request = createRequest()
      var Page = createPageComponent(t, request, host)

      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: PANEL_ID,
        order: 25,
        label: () => t('panel'),
        locale: NS,
      }, Page))

      // 会话窗口：assistant 消息操作条上的「固化为插件」入口
      ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
        name: 'conversation.chat.assistant-actions',
        id: 'plugin-scaffold-capture',
        order: 20,
        locale: NS,
        inject: function (sessionId) { return { captureSessionId: String(sessionId) } },
      }, createCaptureAction(t, request, host)))
    }

    exports.apply = apply
    exports.inject = inject
    exports.PANEL_ID = PANEL_ID
    return module.exports
  },
})