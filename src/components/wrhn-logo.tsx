import { useState } from "react";

export function WrhnLogo() {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="leading-tight"><strong className="text-xl text-primary">WRHN</strong><span className="block text-[10px] text-muted-foreground">Waterloo Regional Health Network</span></div>;
  return <img src="/wrhn-logo.png" onError={() => setFailed(true)} alt="Waterloo Regional Health Network (WRHN)" className="h-10 w-auto object-contain sm:h-11" />;
}