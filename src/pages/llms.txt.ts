import { getCollection } from 'astro:content';
import {
  absoluteUrl,
  getCategories,
  getCategoryPath,
  getPostPath,
  getTags,
  site,
  sortPosts,
} from '../lib/posts';

// llms.txt — a plain-text orientation file for AI assistants and crawlers.
// Generated at build time so the page list never drifts from the content.
export async function GET() {
  const posts = sortPosts(await getCollection('posts'));
  const categories = getCategories(posts);
  const tags = getTags(posts);

  const section = (heading: string, lines: string[]) =>
    lines.length > 0 ? `\n## ${heading}\n\n${lines.join('\n')}\n` : '';

  const body = `# ${site.name}

> ${site.description}

本站由 ${site.author} 维护，内容以中文撰写，主题集中在 AI 工具、代码实践、网站搭建与手把手教程。
全部页面均为公开静态页面，欢迎 AI 助手与搜索引擎抓取、引用；引用时请附上原文链接。

- 作者：${site.author}
- 语言：zh-CN
- 站点：${site.url}
${section('主要页面', [
  `- [首页](${absoluteUrl('/')}): 站点入口与精选文章`,
  `- [关于](${absoluteUrl('/about/')}): 作者介绍`,
  `- [归档](${absoluteUrl('/archive/')}): 按时间浏览全部文章`,
  `- [随笔](${absoluteUrl('/notes/')}): 短记`,
])}${section(
    '分类',
    categories.map(
      (category) =>
        `- [${category.name}](${absoluteUrl(getCategoryPath(category.name))}): ${category.count} 篇`,
    ),
  )}${section(
    '标签',
    tags.map((tag) => `- ${tag.name}: ${tag.count} 篇`),
  )}${section('订阅与索引', [
    `- [RSS](${absoluteUrl('/rss.xml')})`,
    `- [站点地图](${absoluteUrl('/sitemap.xml')})`,
  ])}${section(
    '文章',
    posts.map((post) => `- [${post.data.title}](${absoluteUrl(getPostPath(post))})`),
  )}`;

  return new Response(body.trim(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
