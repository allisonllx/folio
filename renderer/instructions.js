(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('markdown-it'));
  else root.folioInstructions = factory(root.markdownit);
})(typeof window === 'object' ? window : globalThis, function (MarkdownIt) {
  const md = new MarkdownIt({ html: false, linkify: false });
  const escape = md.utils.escapeHtml;
  // References stay local and inert: clicking a link only copies its address.
  md.renderer.rules.link_open = (tokens, i) => `<button type="button" class="markdown-link" data-copy-link="${escape(tokens[i].attrGet('href') || '')}" title="Copy link address">`;
  md.renderer.rules.link_close = () => '</button>';
  md.renderer.rules.image = (tokens, i) => `<span class="markdown-image">Image: ${escape(tokens[i].content || 'Image reference')} <code>${escape(tokens[i].attrGet('src') || '')}</code></span>`;
  function render(source) {
    source = String(source ?? '');
    const frontmatter = source.match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/);
    const metadata = frontmatter ? `<details class="instruction-metadata"><summary>Skill metadata</summary><pre>${escape(frontmatter[1])}</pre></details>` : '';
    return metadata + md.render(frontmatter ? source.slice(frontmatter[0].length) : source);
  }
  return { render };
});
