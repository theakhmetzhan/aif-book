// the posters go into the page itself, so they arrive with it
export default { base: '/aif-book/', build: { chunkSizeWarningLimit: 1500, assetsInlineLimit: f => f.includes('/poster-') || undefined } };
