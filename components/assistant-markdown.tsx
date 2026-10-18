"use client";

import type { ReactNode } from "react";

// Renders a small, safe Markdown subset with React nodes. Model responses are
// untrusted text: never use dangerouslySetInnerHTML or render raw HTML.
function inlineNodes(input: string): ReactNode[] {
  // Handle a few escaped delimiters commonly returned by some models.
  const normalized = input.replace(/\\\*\\\*/g, "**");
  const token = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]{1,150}\]\(https?:\/\/[^)\s]+\))/g;
  const parts: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = token.exec(normalized)) !== null) {
    if (match.index > last) parts.push(normalized.slice(last, match.index));
    const raw = match[0];
    if (raw.startsWith("**")) {
      parts.push(<strong key={i++}>{raw.slice(2, -2)}</strong>);
    } else if (raw.startsWith("*")) {
      parts.push(<em key={i++}>{raw.slice(1, -1)}</em>);
    } else if (raw.startsWith("`")) {
      parts.push(<code key={i++}>{raw.slice(1, -1)}</code>);
    } else if (raw.startsWith("[")) {
      const closing = raw.indexOf("](");
      const title = raw.slice(1, closing);
      const href = raw.slice(closing + 2, -1);
      // Only HTTPS destinations: don't permit javascript: or custom protocols.
      if (href.startsWith("https://")) {
        parts.push(<a key={i++} href={href} target="_blank" rel="noopener noreferrer">{title}</a>);
      } else {
        parts.push(raw);
      }
    }
    last = match.index + raw.length;
  }
  if (last < normalized.length) parts.push(normalized.slice(last));
  return parts;
}

function isBlock(line:string):boolean {
  return /^\s*(?:#{1,4}\s|[-*+]\s|\d+\.\s|(?:---+|\*\*\*+)\s*$|```)/.test(line);
}

export default function AssistantMarkdown({ content }: { content:string }) {
  const lines=content.replace(/\r\n?/g,"\n").split("\n");
  const nodes:ReactNode[]=[];
  let i=0;
  while (i<lines.length) {
    const line=lines[i];
    if (!line.trim()) { i++; continue; }
    const fence=line.match(/^\s*```([^\s`]*)/);
    if (fence) {
      const language=fence[1]||"text";
      i++;
      const codeLines:string[]=[];
      while (i<lines.length && !/^\s*```/.test(lines[i])) codeLines.push(lines[i++]);
      if (i<lines.length) i++;
      nodes.push(<div key={nodes.length} className="assistant-md-code">
        <div className="assistant-md-code-label">{language}</div>
        <pre dir="ltr"><code>{codeLines.join("\n")}</code></pre>
      </div>);
      continue;
    }
    const heading=line.match(/^\s*(#{1,4})\s+(.+)$/);
    if (heading) {
      const level=heading[1].length;
      const title=inlineNodes(heading[2].trim());
      nodes.push(level===1?<h2 key={nodes.length}>{title}</h2>:
        level===2?<h3 key={nodes.length}>{title}</h3>:
        <h4 key={nodes.length}>{title}</h4>);
      i++;continue;
    }
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      nodes.push(<hr key={nodes.length}/>);i++;continue;
    }
    const isUnordered=/^\s*[-*+]\s+/.test(line);
    const isOrdered=/^\s*\d+\.\s+/.test(line);
    if (isUnordered||isOrdered) {
      const items:ReactNode[]=[];
      while (i<lines.length) {
        const thisLine=lines[i];
        const itemMatch=isUnordered
          ? thisLine.match(/^\s*[-*+]\s+(.+)$/)
          : thisLine.match(/^\s*\d+\.\s+(.+)$/);
        if (!itemMatch) break;
        items.push(<li key={items.length}>{inlineNodes(itemMatch[1])}</li>);
        i++;
      }
      nodes.push(isUnordered?<ul key={nodes.length}>{items}</ul>:<ol key={nodes.length}>{items}</ol>);
      continue;
    }
    const paragraph:string[]=[];
    while (i<lines.length && lines[i].trim() && (i===0||!isBlock(lines[i]))) {
      paragraph.push(lines[i]);i++;
    }
    // A previously unhandled block marker can be rendered as normal text.
    if (!paragraph.length) {nodes.push(<p key={nodes.length}>{inlineNodes(lines[i])}</p>);i++;continue;}
    nodes.push(<p key={nodes.length}>{paragraph.map((part,n)=>
      <span key={n}>{n>0 && <><br/></>}{inlineNodes(part)}</span>)}</p>);
  }
  return <div className="assistant-md">{nodes}</div>;
}
