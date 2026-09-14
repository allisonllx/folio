const test = require('node:test');
const assert = require('node:assert/strict');
const {render} = require('../renderer/instructions.js');
test('formats instructions and separates YAML metadata', () => {
  const html = render('---\nname: sample\n---\n# Steps\n\n- **Read** first\n\n```js\nconst x = 1;\n```\n\n| Input | Output |\n| --- | --- |\n| A | B |');
  assert.match(html, /<summary>Skill metadata<\/summary>/);
  assert.match(html, /<h1>Steps<\/h1>/);
  assert.match(html, /<li><strong>Read<\/strong> first<\/li>/);
  assert.match(html, /<code class="language-js">const x = 1;/);
  assert.match(html, /<table>/);
});
test('keeps HTML and image references inert', () => {
  const html = render('<script>window.bad=true</script>\n\n<img src=x onerror="alert(1)">\n\n![Example](https://example.com/image.png)\n\n[Bad](javascript:alert(1))\n\n[Docs](https://example.com/docs)');
  assert.doesNotMatch(html, /<script|<img|<[^>]+(?:href|src)=/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /data-copy-link="https:\/\/example.com\/docs"/);
  assert.match(html, /Image: Example/);
});
test('preserves non-frontmatter markdown and Windows frontmatter', () => {
  assert.match(render('# Heading'), /<h1>Heading/);
  assert.match(render('---\r\nname: test\r\n---\r\n# Body'), /<h1>Body/);
});
