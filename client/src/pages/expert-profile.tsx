import { useParams, useLocation } from "wouter";
import { ExpertProfileEditor } from "@/components/expert-profile-editor";

export default function ExpertProfilePage() {
  const params = useParams<{ id: string }>();
  const expertId = parseInt(params.id || "0", 10);

  if (!expertId) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <h2 className="text-xl font-semibold">Invalid Expert ID</h2>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-8">
      <div>
        <h1 className="text-3xl font-bold">Expert Profile</h1>
      </div>
      <ExpertProfileEditor expertId={expertId} />
    </div>
  );
}
