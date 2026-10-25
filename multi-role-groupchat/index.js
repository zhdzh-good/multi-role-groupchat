/**
 * Host half of the multi-role group-chat plugin.
 *
 * The Host owns storage, the turn orchestrator, prompts, and model calls; the
 * Client half renders the panel and talks to these routes over Connection's
 * authenticated `/api` bridge.
 */

import { GroupStore } from './lib/store.js';
import { registerRoutes } from './lib/routes.js';

/** The Host services this plugin cannot work without. */
export const inject = ['llm', 'connection'];

/**
 * Activate the plugin: create the store, initialize the data directory, and
 * register the authenticated routes.
 * @param {object} ctx - Host plugin context.
 * @returns {void}
 */
export function apply(ctx) {
  const store = new GroupStore();
  store
    .init()
    .catch((error) => {
      ctx.logger?.warn?.(`[multi-role-groupchat] 无法初始化数据目录：${error instanceof Error ? error.message : String(error)}`);
    });
  registerRoutes(ctx, store);
  ctx.effect(() => () => {
    for (const turn of store.turns.values()) turn.abort.abort();
    store.turns.clear();
  }, 'groupchat: abort active turns on unload');
}
