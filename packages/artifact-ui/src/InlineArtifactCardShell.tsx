import type { ReactNode } from "react";
import type { ArtifactSpec } from "@fde/artifact-spec";
import { artifactCardSubtitle } from "./artifactKinds";
import {
  ArtifactCoverIllustration,
  type ArtifactCoverKind,
} from "./ArtifactCoverIllustration";

type Props = {
  spec: ArtifactSpec;
  coverKind: ArtifactCoverKind;
  cardClassName: string;
  actionsAriaLabel: string;
  actions: ReactNode;
  /** When set, replaces the default format-based subtitle. */
  subtitle?: string;
};

export function InlineArtifactCardShell({
  spec,
  coverKind,
  cardClassName,
  actionsAriaLabel,
  actions,
  subtitle,
}: Props) {
  return (
    <div className={`artifact-inline-card ${cardClassName}`} aria-label={spec.title}>
      <ArtifactCoverIllustration kind={coverKind} />
      <div className="artifact-inline-card-main">
        <h4 className="artifact-inline-card-title" title={spec.title}>
          {spec.title}
        </h4>
        <p className="artifact-inline-card-subtitle">
          {subtitle ?? artifactCardSubtitle(spec)}
        </p>
      </div>
      {actions ? (
        <div className={`artifact-inline-card-actions ${cardClassName}-actions`} role="toolbar" aria-label={actionsAriaLabel}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function ArtifactActionGroup({ children }: { children: ReactNode }) {
  return <div className="artifact-inline-action-group">{children}</div>;
}
