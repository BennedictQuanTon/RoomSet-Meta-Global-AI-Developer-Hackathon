export function Landing({ onStart, onSample }: { onStart: () => void; onSample: () => void }) {
  return (
    <section className="hero">
      <h1>Plan your sofa.</h1>
      <p className="intro">
        Plan your sofa in your space. Explore a 3D arrangement built from your photos and confirmed dimensions.
      </p>
      <div className="actions">
        <button className="rs-button" onClick={onStart}>Plan my space</button>
        <button className="rs-button rs-button--secondary" onClick={onSample}>Try a sample room</button>
      </div>
      <ol className="how-it-works">
        <li><strong>Add a sofa.</strong> Paste a listing and confirm its size.</li>
        <li><strong>Show your corner.</strong> Take 3–6 photos or a short video.</li>
        <li><strong>Move it around.</strong> Drag and rotate a true-to-size model in 3D.</li>
      </ol>
    </section>
  );
}
