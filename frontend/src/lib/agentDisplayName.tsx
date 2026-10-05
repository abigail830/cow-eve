/** First token = personal name; remainder = role title (e.g. "Ann Researcher"). */
export function splitAgentDisplayName(displayName: string): {
  name: string;
  title: string | null;
} {
  const trimmed = displayName.trim();
  const space = trimmed.indexOf(" ");
  if (space <= 0) {
    return { name: trimmed, title: null };
  }
  return {
    name: trimmed.slice(0, space),
    title: trimmed.slice(space + 1).trim() || null,
  };
}

type AgentDisplayNameProps = {
  displayName: string;
  className?: string;
  highlightClassName: string;
};

export function AgentDisplayName({
  displayName,
  className,
  highlightClassName,
}: AgentDisplayNameProps) {
  const { name, title } = splitAgentDisplayName(displayName);
  return (
    <span className={className}>
      <span className={highlightClassName}>{name}</span>
      {title ? <> {title}</> : null}
    </span>
  );
}
