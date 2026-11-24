import Nav from '../../components/Nav.js';

export default function PanelLayout({ children }) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </>
  );
}
