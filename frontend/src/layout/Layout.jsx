import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

// Wrap any authenticated page with this to get the sidebar + top bar
// shell. Usage: <Layout><Dashboard /></Layout>
export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Navbar />
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
