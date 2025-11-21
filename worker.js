export default {
  async fetch(request, env) {
    return env.STATIC_ASSETS.fetch(request);
  },
};
