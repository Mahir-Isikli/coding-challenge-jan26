"use client";

import { memo } from "react";
import { Streamdown } from "streamdown";

interface MarkdownProps {
  content: string;
}

function MarkdownComponent({ content }: MarkdownProps) {
  return <Streamdown controls={false}>{content}</Streamdown>;
}

export const Markdown = memo(MarkdownComponent);
