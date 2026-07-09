import { createFileRoute } from "@tanstack/react-router";
import MenuPublico from "@/pages/MenuPublico";

export const Route = createFileRoute("/$slug/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { slug } = Route.useParams();
  return <MenuPublico slug={slug} />;
}
