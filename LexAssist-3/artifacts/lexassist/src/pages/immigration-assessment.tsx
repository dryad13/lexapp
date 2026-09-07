export default function ImmigrationAssessment() {
  const basePath = import.meta.env.BASE_URL || "/";
  const iframeSrc = `${basePath}immigration-tool.html`;

  return (
    <div className="h-full w-full flex flex-col">
      <div className="px-6 pt-6 pb-3">
        <h1 className="text-2xl font-bold tracking-tight">Immigration Eligibility Assessment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Assess client eligibility across UK immigration routes
        </p>
      </div>
      <div className="flex-1 px-6 pb-6">
        <iframe
          src={iframeSrc}
          className="w-full h-full rounded-lg border border-border"
          style={{ minHeight: "calc(100vh - 140px)" }}
          title="Immigration Eligibility Assessment Tool"
        />
      </div>
    </div>
  );
}
