export default function HomePage() {
  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="NOORA home">NOORA</a>
        <nav aria-label="Main navigation">
          <a href="#women">Women</a>
          <a href="#men">Men</a>
          <a href="#children">Children</a>
        </nav>
        <a className="bag-link" href="#shopping">Shopping bag <span aria-label="0 items">(0)</span></a>
      </header>
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">A new way to wear your everyday</p>
        <h1 id="hero-title">Made for the moments that matter.</h1>
        <p className="hero-copy">Discover considered pieces for you and everyone you love.</p>
        <a className="primary-link" href="#collections">Explore the collection</a>
      </section>
      <section className="collections" id="collections" aria-labelledby="collection-title">
        <div>
          <p className="eyebrow">Welcome to NOORA</p>
          <h2 id="collection-title">Find your everyday favourites</h2>
          <p>The store is being prepared. Product collections and shopping features will appear here as they are built.</p>
        </div>
        <p className="collection-note">Clothing for women, men, and children</p>
      </section>
      <footer>
        <span>NOORA</span>
        <span>Sri Lanka · Prices shown in LKR</span>
      </footer>
    </main>
  );
}

