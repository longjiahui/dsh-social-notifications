/**
 * @local/dsh-notifications — Host half.
 *
 * Listens to workspace session status changes and fans each notification out
 * to every enabled notification instance. Provider structure is extensible:
 * `senders` maps an instance `type` to its sender; only `wecom` (WeCom group
 * robot webhook, https://developer.work.weixin.qq.com/document/path/99110)
 * ships today.
 *
 * Instance state lives in this entry's Config (the `notifications` settings
 * namespace), edited live from the Settings panel tab by the client half:
 * `instances` is a volatile array, so edits swap the running reference
 * without restarting this plugin. Every read happens at use time through
 * `readInstances()`, never from a value captured at activation.
 */
import z from '@deepseek-ai/schemastery';

/** Provider types with a sender implementation. */
const PROVIDER_TYPES = ['wecom'];
/** Session event keys an instance can subscribe to. */
const EVENT_KEYS = ['created', 'started', 'completed', 'failed', 'waiting'];
const DEFAULT_EVENTS = { created: false, started: true, completed: true, failed: true, waiting: true };
/** One waiting notification per session within this window, however many asks stack up. */
const WAITING_DEDUP_MS = 30_000;

export const Config = z.object({
  instances: z.array(z.object({
    id: z.string().required().description('Stable unique id of the notification instance.'),
    name: z.string().description('Optional display name.'),
    type: z.union([...PROVIDER_TYPES]).required().description('Notification provider type.'),
    enabled: z.boolean().default(true).description('Whether this instance currently receives notifications.'),
    params: z.object({
      url: z.string().required().description(
        'WeCom group-robot webhook URL (https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...).',
      ),
    }).required().description('Provider-specific parameters. For wecom: the full webhook URL.'),
    events: z.object({
      created: z.boolean().default(false).description('Notify when a session is added.'),
      started: z.boolean().default(true).description('Notify when a session starts running.'),
      completed: z.boolean().default(true).description('Notify when a session finishes running.'),
      failed: z.boolean().default(true).description('Notify when a session reports an error.'),
      waiting: z.boolean().default(true).description(
        'Notify when a session blocks waiting for the user: tool approval, asked question, plan review.',
      ),
    }).description('Which session events this instance receives.'),
  })).default([]).volatile().description('Notification instances, edited live from the Settings panel.'),
});

const ROUTE_PATH = '/dsh-notifications/test-send';
const SEND_TIMEOUT_MS = 10_000;
/** WeCom group robots accept ~20 messages/minute; keep a safety margin. */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 15;
/** Keep markdown well under the 4096-byte API limit. */
const CONTENT_LIMIT_CHARS = 1600;
const ERROR_SNIPPET_CHARS = 400;

/**
 * Read the live instances value: a volatile field resolves to a `{ get }`
 * reference in the running config, and to a plain array at activation.
 * @param {unknown} config - the plugin config object.
 * @returns {unknown[]} the current raw instances array.
 */
function readInstances(config) {
  const raw = config?.instances;
  const value = raw !== null && typeof raw === 'object' && typeof raw.get === 'function' ? raw.get() : raw;
  return Array.isArray(value) ? value : [];
}

/**
 * Normalize and filter the configured instances.
 * @param {unknown} config - the plugin config object.
 * @returns {Array<{id: string, name: string, type: 'wecom', params: {url: string}, events: Record<string, boolean>}>}
 */
function collectInstances(config) {
  const seen = new Set();
  const out = [];
  for (const item of readInstances(config)) {
    if (!item || typeof item !== 'object') continue;
    if (!PROVIDER_TYPES.includes(item.type)) continue;
    if (item.enabled === false) continue;
    const url = item.params?.url;
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) continue;
    const id = typeof item.id === 'string' && item.id.length > 0 ? item.id : `instance-${out.length}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const events = { ...DEFAULT_EVENTS };
    for (const key of EVENT_KEYS) {
      if (typeof item.events?.[key] === 'boolean') events[key] = item.events[key];
    }
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    out.push({ id, name, type: item.type, params: { url }, events });
  }
  return out;
}

/**
 * POST one WeCom group-robot message.
 * @param {{params: {url: string}}} instance - target instance.
 * @param {string} content - markdown content.
 */
async function sendWecom(instance, content) {
  const response = await fetch(instance.params.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ msgtype: 'markdown', markdown: { content } }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    // Non-JSON body; fall through to the status-based error below.
  }
  if (!response.ok || data.errcode !== 0) {
    const detail = data.errcode === undefined
      ? `HTTP ${response.status}`
      : `errcode=${data.errcode}${data.errmsg ? ` ${data.errmsg}` : ''}`;
    throw new Error(detail);
  }
}

/** Provider senders; keyed by instance type. */
const senders = { wecom: sendWecom };

const PLUGIN_LOADER_NAME = '@anfo/dsh-social-notifications';

/**
 * Self-heal the client-modules scan state for this package.
 *
 * On boot, the profile dependency sync can still be extracting this package
 * while `ClientModuleRegistry`'s synchronous constructor scan reads it: the
 * read fails and `resolveMeta()` caches `null` in `pkgMeta` (or the table
 * record snapshots an empty bundle). That state is never refreshed on its
 * own, so the client module stays out of the graph and web boot reports a
 * hard entry failure. Detected here at activation - which runs after the
 * scan - the poisoned state is dropped and the scan re-run once, healing
 * without any manual uninstall/reinstall.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 */
function selfHealClientScan(ctx) {
  ctx.effect(() => {
    try {
      const m = ctx.clientModules;
      if (!m?.table || !m?.pkgMeta) return;
      const baseUrl = ctx.get('loader')?.entries?.().find((row) => row.options.name === PLUGIN_LOADER_NAME)
        ?.parent?.tree?.ctx?.baseUrl;
      if (typeof baseUrl !== 'string' || typeof m.sourceKey !== 'function') return;
      const sourceKey = m.sourceKey(PLUGIN_LOADER_NAME, baseUrl);
      const record = m.table.get(PLUGIN_LOADER_NAME);
      const poisonedMeta = m.pkgMeta.get(sourceKey) === null;
      const emptySnapshot = record !== void 0 && (!record.bundle || record.bundle.length === 0);
      if (!poisonedMeta && !emptySnapshot && record !== void 0) return;
      m.pkgMeta.delete(sourceKey);
      m.table.delete(PLUGIN_LOADER_NAME);
      m.dirty.add(PLUGIN_LOADER_NAME);
      m.flush(() => {});
    } catch {
      // Best-effort: never let the heal break activation.
    }
  }, 'notifications: client scan self-heal');
}

/**
 * Required services. Declared at plugin level so the Loader wires them into
 * this entry's context: `webServer` for the test-send route, the session
 * store and title fold for friendlier message labels. The plugin stays
 * inactive in compositions without them (headless), where there is no web
 * settings surface to configure instances anyway.
 */
export const inject = ['webServer', 'sessions', 'sessionTitle', 'clientModules'];

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {unknown} config - the plugin config object (volatile-aware reads).
 */
export function apply(ctx, config) {
  selfHealClientScan(ctx);
  const rateWindows = new Map();
  const rateWarned = new Set();

  function withinRate(instance) {
    const now = Date.now();
    const window = (rateWindows.get(instance.id) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
    rateWindows.set(instance.id, window);
    if (window.length >= RATE_MAX) {
      if (!rateWarned.has(instance.id)) {
        rateWarned.add(instance.id);
        console.warn(`[dsh-notifications] instance ${instance.id} exceeded ${RATE_MAX} sends/min; dropping further sends in this window`);
      }
      return false;
    }
    rateWarned.delete(instance.id);
    window.push(now);
    return true;
  }

  function sessionLabel(sessionId, summary) {
    const shortId = String(sessionId).replace(/^session-/i, '').slice(0, 8);
    let title;
    try {
      const session = ctx.get('sessions')?.get?.(sessionId);
      title = session && ctx.get('sessionTitle')?.get?.(session)?.title;
    } catch {
      // Best-effort decoration only.
    }
    const cwd = typeof summary?.cwd === 'string' && summary.cwd ? summary.cwd : undefined;
    const place = cwd ? cwd.split(/[\\/]/).filter(Boolean).pop() : undefined;
    const parts = [];
    if (title) parts.push(String(title));
    else if (place) parts.push(place);
    parts.push(`#${shortId}`);
    return parts.join(' · ');
  }

  function clip(text, limit) {
    const line = String(text ?? '').replace(/\s+/g, ' ').trim();
    return line.length > limit ? `${line.slice(0, limit)}…` : line;
  }

  function render(headline, sessionId, summary, errorText) {
    const lines = [
      '**DSH 会话通知**',
      `**${headline}**`,
      `会话：${sessionLabel(sessionId, summary)}`,
    ];
    if (typeof summary?.cwd === 'string' && summary.cwd) lines.push(`目录：${clip(summary.cwd, 200)}`);
    if (errorText) lines.push(`错误：${clip(errorText, ERROR_SNIPPET_CHARS)}`);
    lines.push(`时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`);
    return lines.join('\n').slice(0, CONTENT_LIMIT_CHARS);
  }

  async function broadcast(eventKey, content) {
    await Promise.all(collectInstances(config)
      .filter((instance) => instance.events[eventKey])
      .map(async (instance) => {
        if (!withinRate(instance)) return;
        try {
          const send = senders[instance.type];
          if (!send) throw new Error(`no sender for type ${instance.type}`);
          await send(instance, content);
        } catch (error) {
          console.warn(`[dsh-notifications] send to instance ${instance.id} failed:`, error?.message ?? error);
        }
      }));
  }

  const waitingLast = new Map();

  /**
   * Notify a blocked-on-user state, at most one message per session within
   * WAITING_DEDUP_MS so stacked approval/question asks do not spam the group.
   */
  function notifyWaiting(sessionId, summary, detail) {
    if (!sessionId) return;
    const now = Date.now();
    if (now - (waitingLast.get(sessionId) ?? 0) < WAITING_DEDUP_MS) return;
    waitingLast.set(sessionId, now);
    const lines = [
      '**DSH 会话通知**',
      `**等待中 · ${clip(summary, 120)}**`,
      `会话：${sessionLabel(sessionId)}`,
    ];
    if (detail) lines.push(`详情：${clip(detail, ERROR_SNIPPET_CHARS)}`);
    lines.push(`时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`);
    void broadcast('waiting', lines.join('\n').slice(0, CONTENT_LIMIT_CHARS));
  }

  ctx.on('api-session/added', (summary) => {
    if (summary?.blank) return;
    void broadcast('created', render('新会话', summary.sessionId, summary));
  });
  ctx.on('api-session/status', (sessionId, running) => {
    void broadcast(running ? 'started' : 'completed', render(running ? '开始运行' : '运行完成', sessionId));
  });
  ctx.on('api-session/error', (sessionId, message) => {
    void broadcast('failed', render('运行出错', sessionId, undefined, message));
  });
  // Waiting (blocked-on-user) events. The approval and question waterfalls are
  // dispatched SCOPE-TARGETED at the asking agent and run listeners CHAINED:
  // the browser answerer registers early and claims the request on its turn,
  // so the taps must sit { global: true, prepend: true } — first in every
  // scope's chain, observing and then delegating with next(). The payload
  // carries the asking agent, whose `session.id` names the session.
  ctx.on('approval/request', (req, next) => {
    try {
      const sessionId = req?.agent?.session?.id ?? req?.agent?.id;
      if (sessionId) {
        notifyWaiting(
          sessionId,
          req?.toolName ? `工具确认 · ${req.toolName}` : '工具确认',
          typeof req?.reason === 'string' && req.reason ? req.reason : req?.displayReason?.zh ?? req?.displayReason?.en,
        );
      }
    } catch {
      // Notification is best-effort; never break the approval chain.
    }
    return next();
  }, { global: true, prepend: true });
  ctx.on('user-questions/request', (request, next) => {
    try {
      const sessionId = request?.agent?.session?.id ?? request?.agent?.id;
      if (sessionId) {
        const questions = Array.isArray(request?.questions) ? request.questions : [];
        const first = questions[0];
        const summary = questions.length > 1
          ? `等待输入（${questions.length} 个问题）`
          : `等待输入${first?.header ? ` · ${first.header}` : ''}`;
        notifyWaiting(sessionId, summary, first?.question);
      }
    } catch {
      // Notification is best-effort; never break the question chain.
    }
    return next();
  }, { global: true, prepend: true });

  // Test-send route: a fixed local-only POST that exercises every enabled
  // instance so the user can validate webhook URLs from the Settings tab.
  // `webServer` is declared in this plugin's inject, so the property is
  // available by the time apply runs.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE_PATH,
    handler: (req, res) => {
      void handleTestSend(req, res).catch((error) => {
        try {
          res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: String(error?.message ?? error) }));
        } catch {
          // Response already gone.
        }
      });
    },
  }), 'notifications: test-send route');

  async function handleTestSend(req, res) {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { ok: false, error: 'POST only' });
    }
    if (!isLoopback(req.socket?.remoteAddress)) {
      return sendJson(res, 403, { ok: false, error: 'local requests only' });
    }
    const content = [
      '**DSH 会话通知**',
      '**测试消息**',
      `这是一条测试通知，发送于 ${new Date().toLocaleString('zh-CN', { hour12: false })}。`,
      '会话状态变化（开始运行 / 运行完成 / 运行出错）将推送到此群。',
    ].join('\n');
    const results = await Promise.all(collectInstances(config).map(async (instance) => {
      try {
        const send = senders[instance.type];
        if (!send) throw new Error(`no sender for type ${instance.type}`);
        await send(instance, content);
        return { id: instance.id, name: instance.name || instance.id, ok: true };
      } catch (error) {
        return { id: instance.id, name: instance.name || instance.id, ok: false, error: String(error?.message ?? error) };
      }
    }));
    return sendJson(res, 200, { ok: results.length > 0 && results.every((item) => item.ok), results });
  }
}

/** @param {string | undefined} address - socket remote address. */
function isLoopback(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}
