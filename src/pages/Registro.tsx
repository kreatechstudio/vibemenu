import Layout from "@/components/layout/Layout";
import RegistroAsistido from "@/components/registro/RegistroAsistido";

export default function Registro() {
  return (
    <Layout>
      <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
        <RegistroAsistido />
      </section>
    </Layout>
  );
}
