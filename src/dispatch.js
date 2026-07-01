/**
 * Tool dispatch — shared by the MCP server and the demo, so there is a single
 * source of truth for tool behavior (a habit migrated from field-registry's
 * service layer, where REST and MCP shared one implementation).
 */

const { resolve } = require('./protocol/resolve');
const { bind } = require('./protocol/bind');
const { verify } = require('./protocol/verify');

function createDispatcher(store) {
  return function callTool(name, args = {}) {
    switch (name) {
      case 'resolve':
        return resolve(store, args.alias, { limit: args.limit });

      case 'get_constraint': {
        const unit = store.get(args.id);
        return unit || { error: `Unknown constraint id: ${args.id}` };
      }

      case 'bind_constraints':
        return bind(store, args);

      case 'verify_usage':
        return verify(store, args);

      default:
        return { error: `Unknown tool: ${name}` };
    }
  };
}

module.exports = { createDispatcher };
