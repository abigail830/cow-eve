import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./MarkdownContent.css";

type Props = {
  text: string;
  className?: string;
};

export const MarkdownContent = memo(function MarkdownContent({
  text,
  className = "",
}: Props) {
  return (
    <div className={`markdown-content ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
});
