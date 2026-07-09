import type { ReactNode } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

interface LayoutProps {
  children: ReactNode;
}

/** Cascaron de las paginas publicas de marketing. El menu publico del tenant NO lo usa. */
export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />
      {/* pt-16 compensa la navbar fija */}
      <main className="flex-1 pt-16">{children}</main>
      <Footer />
    </div>
  );
}
