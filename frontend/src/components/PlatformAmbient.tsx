/** Fixed mesh gradient + grain; one instance per full-page shell. */
export function PlatformAmbient() {
  return (
    <div className="platform-ambient" aria-hidden="true">
      <div className="platform-orb platform-orb--peach" />
      <div className="platform-orb platform-orb--warm" />
      <div className="platform-orb platform-orb--neutral" />
      <div className="platform-ambient-grain" />
    </div>
  );
}
