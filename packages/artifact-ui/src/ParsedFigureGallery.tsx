import { listFiguresFromMeta } from "./documentPreviewKinds";
import { AuthenticatedFigureImage } from "./ParsedDocumentMarkdownPreview";

type Props = {
  meta: Record<string, unknown> | null | undefined;
  token?: string | null;
  resolveFigureUrl: (figureRef: string) => string;
};

export function ParsedFigureGallery({ meta, token, resolveFigureUrl }: Props) {
  const figures = listFiguresFromMeta(meta);
  if (!figures.length) return null;

  return (
    <section className="parsed-figure-gallery" aria-label="Extracted figures">
      <h4 className="parsed-figure-gallery-title">Figures ({figures.length})</h4>
      <ul className="parsed-figure-gallery-grid">
        {figures.map((fig) => (
          <li key={fig.id}>
            <AuthenticatedFigureImage
              src={`figure:${fig.id}`}
              alt={fig.filename ?? fig.id}
              token={token}
              resolveFigureUrl={resolveFigureUrl}
            />
            <span className="parsed-figure-gallery-caption">
              {fig.filename ?? fig.id}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
