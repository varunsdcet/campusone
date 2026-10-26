"use client";

import { useMemo } from "react";
import { marked, Renderer } from "marked";

const renderer = new Renderer();
renderer.link = ({ href, title, text }) => {
  const safeHref = safeUrl(href);
  const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
  return `<a href="${escapeAttr(safeHref)}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
};
renderer.image = ({ href, title, text }) => {
  const safeHref = safeUrl(href);
  if (safeHref === "#") return escapeHtml(text || "Image");
  const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
  return `<img src="${escapeAttr(safeHref)}" alt="${escapeAttr(text || "")}"${titleAttr}>`;
};
// Model output is Markdown, not trusted HTML. Render raw HTML as text so there is
// no browser HTML parser attack surface to patch with a regex deny-list.
renderer.html = ({ text }) => escapeHtml(text);

marked.setOptions({
  gfm: true,
  breaks: true,
  renderer,
});

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeHtml(value: string) {
  return escapeAttr(value).replace(/>/g, "&gt;");
}

function safeUrl(value: string | null | undefined) {
  const href = (value || "").trim();
  if (!href) return "#";
  if (href.startsWith("/") || href.startsWith("#")) return href;
  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? href : "#";
  } catch {
    return "#";
  }
}

export function renderMarkdownHtml(text: string): string {
  const parsed = marked.parse(text || "", { async: false });
  return typeof parsed === "string" ? parsed : String(parsed);
}

export function MarkdownMessage({
  text,
  className = "mh-ask-md",
}: {
  text: string;
  className?: string;
}) {
  const html = useMemo(() => renderMarkdownHtml(text), [text]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
