import { createFileRoute } from "@tanstack/react-router";

import { Treadmill } from "@/components/treadmill";

export const Route = createFileRoute("/_auth/app/")({
  component: AppIndex,
});

function AppIndex() {
  return (
    <div className="mx-auto max-w-sm p-4">
      <Treadmill />
    </div>
  );
}
