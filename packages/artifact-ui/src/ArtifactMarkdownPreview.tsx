import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  markdown: string;
  className?: string;
};

export const ArtifactMarkdownPreview = memo(function ArtifactMarkdownPreview({
  markdown,
  className = "",
}: Props) {
  return (
    <div className={`artifact-markdown-preview ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
});
