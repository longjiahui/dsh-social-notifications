/**
 * @local/dsh-notifications — browser half.
 *
 * Registers a "Notifications" page into the Settings panel's
 * `settings.section` slot and provides CRUD over the plugin's notification
 * instances. Instances live in the `notifications` settings namespace (this
 * bundle's Loader entry config), read and written through the built-in
 * `remote.settings` Remote: describe() to read, replace() with the revision
 * to write, `settings/document-updated` to follow external changes.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-notifications',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS_ID = 'notifications';
    /**
     * Settings namespaces are profile entry ids; include-layer compositions
     * prefix them, so match both spellings.
     */
    const isNotificationsNs = (ns) => ns === NS_ID || ns === `include:${NS_ID}`;
    const NS = 'settings.notifications';
    const ROUTE_PATH = '/dsh-notifications/test-send';
    const DOC_URL = 'https://developer.work.weixin.qq.com/document/path/99110';
    /** Display order of session events on the page. */
    const EVENT_DEFS = [
      { key: 'created', dict: 'evCreated' },
      { key: 'started', dict: 'evStarted' },
      { key: 'completed', dict: 'evCompleted' },
      { key: 'failed', dict: 'evFailed' },
      { key: 'waiting', dict: 'evWaiting' },
    ];
    const DEFAULT_EVENTS = { created: false, started: true, completed: true, failed: true, waiting: true };
    const PROVIDERS = [{ type: 'wecom', dict: 'providerWecom' }];

    const zh = {
      title: '通知',
      description: '把工作区会话状态变化实时推送到通知提供方（当前支持企业微信群机器人）。',
      loading: '正在读取通知配置…',
      unavailable: '通知插件未加载，暂时无法配置。',
      loadFailed: '读取通知配置失败。',
      retry: '重试',
      readOnly: '本部署的设置为只读。',
      add: '添加通知',
      editing: '编辑通知',
      name: '名称（可选）',
      namePlaceholder: '例如：项目群机器人',
      type: '类型',
      providerWecom: '企业微信群机器人',
      url: 'Webhook URL',
      urlPlaceholder: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…',
      urlHint: '在企业微信群里添加群机器人后，复制其 Webhook 地址。参见',
      docLink: '企业微信消息推送文档',
      urlInvalid: '请填写有效的 http(s) 地址。',
      urlForeign: '地址不在 qyapi.weixin.qq.com 域名下，请确认这是你的群机器人（或代理）地址。',
      events: '通知事件',
      evCreated: '新会话',
      evStarted: '开始运行',
      evCompleted: '运行完成',
      evFailed: '运行出错',
      evWaiting: '等待确认/输入',
      enabled: '启用',
      save: '保存',
      saving: '保存中…',
      cancel: '取消',
      edit: '编辑',
      remove: '删除',
      removeConfirm: '确认删除',
      saved: '已保存。',
      saveFailed: '保存失败，请重试。',
      test: '发送测试通知',
      testing: '发送中…',
      testOk: '测试通知已发送。',
      testPartial: '部分实例发送失败，请查看结果。',
      testNone: '没有已启用的通知实例。',
      testFailed: '测试请求失败。',
      testResultOk: '成功',
      testResultFailed: '失败',
      noInstances: '还没有通知实例。点击「添加通知」，把企业微信群机器人的 Webhook 地址接进来。',
      switchHint: '关闭后此实例不再接收通知。',
      disabledTag: '已停用',
    };
    const en = {
      title: 'Notifications',
      description: 'Push workspace session status changes to notification providers (WeCom group robot today).',
      loading: 'Loading notification settings…',
      unavailable: 'The notifications plugin is not loaded, so it cannot be configured right now.',
      loadFailed: 'Failed to load notification settings.',
      retry: 'Retry',
      readOnly: 'This deployment stores settings read-only.',
      add: 'Add notification',
      editing: 'Edit notification',
      name: 'Name (optional)',
      namePlaceholder: 'e.g. Team group robot',
      type: 'Type',
      providerWecom: 'WeCom group robot',
      url: 'Webhook URL',
      urlPlaceholder: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…',
      urlHint: 'Add a group robot to a WeCom group and copy its webhook URL. See the',
      docLink: 'WeCom message push docs',
      urlInvalid: 'Enter a valid http(s) URL.',
      urlForeign: 'The URL is outside qyapi.weixin.qq.com; make sure this is your robot (or proxy) endpoint.',
      events: 'Events',
      evCreated: 'Session created',
      evStarted: 'Started running',
      evCompleted: 'Finished running',
      evFailed: 'Run errored',
      evWaiting: 'Waiting on user',
      enabled: 'Enabled',
      save: 'Save',
      saving: 'Saving…',
      cancel: 'Cancel',
      edit: 'Edit',
      remove: 'Delete',
      removeConfirm: 'Confirm delete',
      saved: 'Saved.',
      saveFailed: 'Saving failed, please retry.',
      test: 'Send test notification',
      testing: 'Sending…',
      testOk: 'Test notification sent.',
      testPartial: 'Some instances failed; check the results below.',
      testNone: 'No enabled notification instances.',
      testFailed: 'The test request failed.',
      testResultOk: 'delivered',
      testResultFailed: 'failed',
      noInstances: 'No notification instances yet. Click "Add notification" to connect a WeCom group robot webhook.',
      switchHint: 'When off, this instance receives no notifications.',
      disabledTag: 'disabled',
    };

    const css = [
      '.ntf-page{min-height:100%;box-sizing:border-box;padding:20px 24px 40px;display:flex;flex-direction:column;gap:14px;max-width:720px}',
      '.ntf-desc{color:var(--dsw-alias-label-secondary);margin:0;font-size:13px;line-height:1.5}',
      '.ntf-hint{color:var(--dsw-alias-label-secondary);margin:0;font-size:12px;line-height:1.5}',
      '.ntf-error{color:var(--dsw-alias-state-error-primary);margin:0;font-size:13px;line-height:1.5}',
      '.ntf-ok{color:var(--dsw-alias-state-success-primary);margin:0;font-size:13px;line-height:1.5}',
      '.ntf-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px}',
      '.ntf-list{display:flex;flex-direction:column;gap:10px}',
      '.ntf-card{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:12px 14px;display:flex;flex-direction:column;gap:8px}',
      '.ntf-card-off{opacity:0.65}',
      '.ntf-row{display:flex;align-items:center;gap:10px}',
      '.ntf-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ntf-badge{flex:none;font-size:11px;line-height:1;padding:4px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2)}',
      '.ntf-tag{flex:none;font-size:11px;line-height:1;padding:4px 8px;border-radius:999px;color:var(--dsw-alias-state-warn-primary);border:1px solid var(--dsw-alias-border-l2)}',
      '.ntf-spacer{flex:1}',
      '.ntf-url{color:var(--dsw-alias-label-secondary);font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ntf-chips{display:flex;flex-wrap:wrap;gap:6px}',
      '.ntf-chip{font-size:11px;line-height:1;padding:4px 8px;border-radius:6px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2)}',
      '.ntf-actions{display:flex;gap:6px}',
      '.ntf-btn{appearance:none;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12px;line-height:1;padding:7px 12px;border-radius:8px;cursor:pointer}',
      '.ntf-btn:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.ntf-btn:disabled{opacity:0.5;cursor:default}',
      '.ntf-btn-primary{background:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-base)}',
      '.ntf-btn-primary:hover{opacity:0.88;background:var(--dsw-alias-label-primary)}',
      '.ntf-btn-danger{color:var(--dsw-alias-state-error-primary)}',
      '.ntf-switch{flex:none;width:34px;height:20px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);position:relative;cursor:pointer;padding:0}',
      '.ntf-switch[aria-checked="true"]{background:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-primary)}',
      '.ntf-switch-dot{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:999px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);transition:left 0.15s ease;box-sizing:border-box}',
      '.ntf-switch[aria-checked="true"] .ntf-switch-dot{left:16px}',
      '.ntf-form{display:grid;grid-template-columns:1fr;gap:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:14px;background:var(--dsw-alias-bg-layer-2)}',
      '.ntf-field{display:grid;gap:5px}',
      '.ntf-label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.ntf-input{appearance:none;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;padding:8px 10px;width:100%;box-sizing:border-box}',
      '.ntf-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}',
      '.ntf-select{appearance:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;padding:8px 10px}',
      '.ntf-checks{display:flex;flex-wrap:wrap;gap:12px}',
      '.ntf-check{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-primary)}',
      '.ntf-switchrow{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--dsw-alias-label-primary)}',
      '.ntf-test{display:flex;flex-direction:column;gap:8px}',
      '.ntf-test-results{display:flex;flex-direction:column;gap:4px;margin:0;padding:0;list-style:none}',
      '.ntf-test-result{font-size:12px;color:var(--dsw-alias-label-secondary);display:flex;gap:8px;align-items:baseline}',
      '.ntf-test-state-ok{color:var(--dsw-alias-state-success-primary)}',
      '.ntf-test-state-bad{color:var(--dsw-alias-state-error-primary)}',
    ].join('\n');
    const CSS_TAG_ID = '@local/dsh-notifications/page.module.css';
    if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css="${CSS_TAG_ID}"]`) === null) {
      const tag = document.createElement('style');
      tag.dataset.plugin = '@local/dsh-notifications';
      tag.dataset.pluginCss = CSS_TAG_ID;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    function uuid() {
      return (crypto && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : `ntf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function errorText(error) {
      if (error == null) return 'unknown';
      if (typeof error === 'string') return error;
      const message = typeof error.message === 'string' && error.message ? error.message : undefined;
      const code = typeof error.code === 'string' && error.code ? error.code : undefined;
      if (message && code && code !== message) return `${message} (${code})`;
      if (message || code) return String(message ?? code);
      try { return JSON.stringify(error).slice(0, 200); } catch { return String(error); }
    }

    /**
     * Unwrap a generated-remote `{ok, value | error}` envelope: generated
     * client stubs resolve to the protocol result wrapper, not the bare value.
     */
    async function callRemote(promise) {
      const response = await promise;
      if (response == null || typeof response !== 'object' || !('ok' in response)) return response;
      if (response.ok !== true) throw new Error(errorText(response.error));
      return response.value;
    }

    function maskUrl(raw) {
      try {
        const url = new URL(raw);
        const key = url.searchParams.get('key');
        if (key && key.length > 4) url.searchParams.set('key', `…${key.slice(-4)}`);
        return url.toString();
      } catch {
        return raw.length > 72 ? `${raw.slice(0, 72)}…` : raw;
      }
    }

    function emptyDraft() {
      return {
        id: uuid(),
        name: '',
        type: 'wecom',
        url: '',
        enabled: true,
        events: { ...DEFAULT_EVENTS },
      };
    }

    /**
     * Build the Settings page component with the plugin context bound.
     * @param {object} ctx - client plugin context (remote, locale services).
     */
    function NotificationsSection(ctx) {
      const t = ctx.locale.bind(NS);

      return function Section() {
        const [doc, setDoc] = React.useState({ status: 'loading', instances: [], revision: 0, writable: true, user: null, seenNs: [] });
        const [draft, setDraft] = React.useState(null);
        const [busy, setBusy] = React.useState(false);
        const [notice, setNotice] = React.useState(null);
        const [testing, setTesting] = React.useState(false);
        const [testResult, setTestResult] = React.useState(null);
        const [removeArm, setRemoveArm] = React.useState(null);

        const readDocument = React.useCallback(async () => {
          try {
            const describe = await callRemote(ctx.remote.settings.describe());
            const view = (describe.namespaces ?? []).find((entry) => isNotificationsNs(entry.ns));
            if (!view) {
              setDoc({
                status: 'missing',
                instances: [],
                revision: 0,
                writable: false,
                user: null,
                seenNs: (describe.namespaces ?? []).map((row) => String(row.ns)),
              });
              return;
            }
            setDoc({
              status: 'ready',
              instances: Array.isArray(view.value?.instances) ? view.value.instances : [],
              revision: view.revision,
              writable: describe.writable !== false,
              user: view.user ?? null,
            });
          } catch (error) {
            setDoc({ status: 'error', instances: [], revision: 0, writable: false, user: null, error: errorText(error) });
          }
        }, []);

        React.useEffect(() => {
          readDocument();
          return ctx.remote.$on('settings/document-updated', (ns) => {
            if (isNotificationsNs(ns)) readDocument();
          });
        }, [readDocument]);

        /** Write the whole instances list through the settings Remote. */
        const persist = React.useCallback(async (nextInstances) => {
          setBusy(true);
          setNotice(null);
          try {
            const describe = await callRemote(ctx.remote.settings.describe());
            const view = (describe.namespaces ?? []).find((entry) => isNotificationsNs(entry.ns));
            if (!view) throw new Error(t('unavailable'));
            const section = { ...(view.user && typeof view.user === 'object' ? view.user : {}) };
            section.instances = nextInstances;
            const updated = await callRemote(ctx.remote.settings.replace(view.ns, section, view.revision));
            setDoc((current) => ({
              ...current,
              status: 'ready',
              instances: Array.isArray(updated.value?.instances) ? updated.value.instances : nextInstances,
              revision: updated.revision,
              writable: describe.writable !== false,
              user: updated.user ?? section,
            }));
            setNotice({ kind: 'ok', text: t('saved') });
            return true;
          } catch (error) {
            setNotice({ kind: 'error', text: `${t('saveFailed')} (${errorText(error)})` });
            await readDocument();
            return false;
          } finally {
            setBusy(false);
          }
        }, [readDocument]);

        const sendTest = React.useCallback(async () => {
          setTesting(true);
          setTestResult(null);
          try {
            const response = await fetch(ROUTE_PATH, { method: 'POST', headers: { 'content-type': 'application/json' } });
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload || !Array.isArray(payload.results)) {
              setNotice({ kind: 'error', text: t('testFailed') });
              return;
            }
            setTestResult(payload.results);
            const enabled = doc.instances.filter((instance) => instance.enabled !== false);
            if (enabled.length === 0) setNotice({ kind: 'error', text: t('testNone') });
            else if (payload.ok) setNotice({ kind: 'ok', text: t('testOk') });
            else setNotice({ kind: 'error', text: t('testPartial') });
          } catch (error) {
            setNotice({ kind: 'error', text: `${t('testFailed')} (${errorText(error)})` });
          } finally {
            setTesting(false);
          }
        }, [doc.instances]);

        const instanceItems = doc.instances;
        const writable = doc.writable && !busy;

        const startAdd = () => {
          setRemoveArm(null);
          setDraft(emptyDraft());
        };
        const startEdit = (instance) => {
          setRemoveArm(null);
          setDraft({
            id: instance.id,
            name: typeof instance.name === 'string' ? instance.name : '',
            type: instance.type,
            url: instance.params?.url ?? '',
            enabled: instance.enabled !== false,
            events: { ...DEFAULT_EVENTS, ...(instance.events ?? {}) },
          });
        };

        const draftUrlValid = /^https?:\/\/.+/i.test(draft?.url ?? '');

        const saveDraft = async () => {
          if (!draft || !draftUrlValid) return;
          const next = {
            id: draft.id,
            name: draft.name.trim(),
            type: draft.type,
            enabled: draft.enabled,
            params: { url: draft.url.trim() },
            events: { ...draft.events },
          };
          const exists = instanceItems.some((instance) => instance.id === next.id);
          const nextInstances = exists
            ? instanceItems.map((instance) => (instance.id === next.id ? next : instance))
            : [...instanceItems, next];
          if (await persist(nextInstances)) setDraft(null);
        };

        const toggleInstance = async (instance) => {
          const nextInstances = instanceItems.map((item) => (item.id === instance.id
            ? { ...item, enabled: !(item.enabled !== false) }
            : item));
          await persist(nextInstances);
        };

        const removeInstance = async (instance) => {
          if (removeArm !== instance.id) {
            setRemoveArm(instance.id);
            return;
          }
          setRemoveArm(null);
          await persist(instanceItems.filter((item) => item.id !== instance.id));
        };

        if (doc.status === 'loading') return h('div', { className: 'ntf-page' }, h('p', { className: 'ntf-hint' }, t('loading')));
        if (doc.status === 'missing') {
          return h('div', { className: 'ntf-page' },
            h('p', { className: 'ntf-hint' }, t('unavailable')),
            h('p', { className: 'ntf-hint' }, `settings ns: ${doc.seenNs.length > 0 ? doc.seenNs.join(', ') : '(none)'}`),
            h('div', { className: 'ntf-actions' },
              h('button', { type: 'button', className: 'ntf-btn', onClick: readDocument }, t('retry')),
            ),
          );
        }
        if (doc.status === 'error') {
          return h('div', { className: 'ntf-page' }, h('p', { className: 'ntf-error' }, `${t('loadFailed')} (${doc.error ?? ''})`));
        }

        return h('div', { className: 'ntf-page' },
          h('p', { className: 'ntf-desc' }, t('description')),
          !doc.writable && h('p', { className: 'ntf-hint' }, t('readOnly')),

          draft !== null && h('div', { className: 'ntf-form' },
            h('div', { className: 'ntf-label' }, draft.id && instanceItems.some((item) => item.id === draft.id) ? t('editing') : t('add')),
            h('div', { className: 'ntf-field' },
              h('label', { className: 'ntf-label', htmlFor: 'ntf-name' }, t('name')),
              h('input', {
                id: 'ntf-name', className: 'ntf-input', placeholder: t('namePlaceholder'), value: draft.name,
                onChange: (event) => setDraft({ ...draft, name: event.target.value }),
              }),
            ),
            h('div', { className: 'ntf-field' },
              h('label', { className: 'ntf-label', htmlFor: 'ntf-type' }, t('type')),
              h('select', {
                id: 'ntf-type', className: 'ntf-select', value: draft.type,
                onChange: (event) => setDraft({ ...draft, type: event.target.value }),
              }, PROVIDERS.map((provider) => h('option', { key: provider.type, value: provider.type }, t(provider.dict)))),
            ),
            h('div', { className: 'ntf-field' },
              h('label', { className: 'ntf-label', htmlFor: 'ntf-url' }, t('url')),
              h('input', {
                id: 'ntf-url', className: 'ntf-input', type: 'url', placeholder: t('urlPlaceholder'), value: draft.url,
                spellCheck: false,
                onChange: (event) => setDraft({ ...draft, url: event.target.value }),
              }),
              h('p', { className: 'ntf-hint' },
                `${t('urlHint')} `,
                h('a', { href: DOC_URL, target: '_blank', rel: 'noopener noreferrer' }, t('docLink')),
                '。',
              ),
              draft.url.length > 0 && !draftUrlValid && h('p', { className: 'ntf-error' }, t('urlInvalid')),
              draftUrlValid && (() => {
                try {
                  return new URL(draft.url).hostname.endsWith('qyapi.weixin.qq.com')
                    ? null
                    : h('p', { className: 'ntf-hint' }, t('urlForeign'));
                } catch {
                  return null;
                }
              })(),
            ),
            h('div', { className: 'ntf-field' },
              h('span', { className: 'ntf-label' }, t('events')),
              h('div', { className: 'ntf-checks' }, EVENT_DEFS.map((def) => h('label', { key: def.key, className: 'ntf-check' },
                h('input', {
                  type: 'checkbox', checked: draft.events[def.key] !== false,
                  onChange: (event) => setDraft({ ...draft, events: { ...draft.events, [def.key]: event.target.checked } }),
                }),
                t(def.dict),
              ))),
            ),
            h('div', { className: 'ntf-switchrow' },
              h('button', {
                type: 'button', className: 'ntf-switch', role: 'switch', 'aria-checked': draft.enabled ? 'true' : 'false',
                'aria-label': t('enabled'), disabled: !writable,
                onClick: () => setDraft({ ...draft, enabled: !draft.enabled }),
              }, h('span', { className: 'ntf-switch-dot' })),
              h('span', null, t('enabled')),
              h('span', { className: 'ntf-hint' }, t('switchHint')),
            ),
            h('div', { className: 'ntf-actions' },
              h('button', { type: 'button', className: 'ntf-btn ntf-btn-primary', disabled: !writable || !draftUrlValid, onClick: saveDraft },
                busy ? t('saving') : t('save')),
              h('button', { type: 'button', className: 'ntf-btn', disabled: busy, onClick: () => setDraft(null) }, t('cancel')),
            ),
          ),

          draft === null && h('div', { className: 'ntf-toolbar' },
            h('button', { type: 'button', className: 'ntf-btn ntf-btn-primary', disabled: !writable, onClick: startAdd }, t('add')),
            h('div', { className: 'ntf-test' },
              h('button', {
                type: 'button', className: 'ntf-btn', disabled: testing || instanceItems.filter((item) => item.enabled !== false).length === 0,
                onClick: sendTest,
              }, testing ? t('testing') : t('test')),
            ),
          ),

          notice !== null && h('p', { className: notice.kind === 'ok' ? 'ntf-ok' : 'ntf-error' }, notice.text),
          testResult !== null && h('ul', { className: 'ntf-test-results' }, testResult.map((result) => h('li', { key: result.id, className: 'ntf-test-result' },
            h('span', { className: result.ok ? 'ntf-test-state-ok' : 'ntf-test-state-bad' }, result.ok ? t('testResultOk') : t('testResultFailed')),
            h('span', null, result.name || result.id),
            !result.ok && result.error ? h('span', null, `— ${result.error}`) : null,
          ))),

          instanceItems.length === 0 && h('p', { className: 'ntf-hint' }, t('noInstances')),
          h('div', { className: 'ntf-list' }, instanceItems.map((instance) => {
            const enabled = instance.enabled !== false;
            const arming = removeArm === instance.id;
            return h('div', { key: instance.id, className: `ntf-card${enabled ? '' : ' ntf-card-off'}` },
              h('div', { className: 'ntf-row' },
                h('span', { className: 'ntf-title' }, instance.name || instance.id.slice(0, 8)),
                h('span', { className: 'ntf-badge' }, t(PROVIDERS.find((provider) => provider.type === instance.type)?.dict ?? 'providerWecom')),
                !enabled && h('span', { className: 'ntf-tag' }, t('disabledTag')),
                h('span', { className: 'ntf-spacer' }),
                h('button', {
                  type: 'button', className: 'ntf-switch', role: 'switch', 'aria-checked': enabled ? 'true' : 'false',
                  'aria-label': t('enabled'), disabled: !writable, title: t('switchHint'),
                  onClick: () => toggleInstance(instance),
                }, h('span', { className: 'ntf-switch-dot' })),
              ),
              h('div', { className: 'ntf-url' }, maskUrl(instance.params?.url ?? '')),
              h('div', { className: 'ntf-chips' }, EVENT_DEFS
                .filter((def) => (instance.events?.[def.key] ?? DEFAULT_EVENTS[def.key]))
                .map((def) => h('span', { key: def.key, className: 'ntf-chip' }, t(def.dict)))),
              h('div', { className: 'ntf-actions' },
                h('button', { type: 'button', className: 'ntf-btn', disabled: !writable, onClick: () => startEdit(instance) }, t('edit')),
                h('button', {
                  type: 'button', className: `ntf-btn${arming ? ' ntf-btn-danger' : ''}`, disabled: !writable,
                  onClick: () => removeInstance(instance),
                }, arming ? t('removeConfirm') : t('remove')),
                arming && h('button', { type: 'button', className: 'ntf-btn', disabled: !writable, onClick: () => setRemoveArm(null) }, t('cancel')),
              ),
            );
          })),
        );
      };
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.settings'],
      apply(ctx) {
        const t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-notifications: dictionaries');
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: NS_ID,
          order: 90,
          label: () => t('title'),
          locale: NS,
        }, NotificationsSection(ctx)));
      },
    };
  },
});
