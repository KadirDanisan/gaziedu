import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";

function SiteLayout() {
  return (
    <div className="page">
      <Header />
      <Outlet />
      <Footer />
    </div>
  );
}

export default SiteLayout;
