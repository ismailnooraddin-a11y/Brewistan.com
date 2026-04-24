import { Suspense } from "react";
import GetStartedContent from "./GetStartedContent";

export default function GetStartedPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GetStartedContent />
    </Suspense>
  );
}
