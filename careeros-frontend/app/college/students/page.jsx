import { Suspense } from "react";
import { LoadingState } from "@/components/loading-state";
import CollegeStudentsView from "./students-view";

export default function CollegeStudentsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading students…" />}>
      <CollegeStudentsView />
    </Suspense>
  );
}
