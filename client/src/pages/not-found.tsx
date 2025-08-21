import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  console.warn('NOTFOUND_RENDER', window.location.pathname);
  // Render a tiny marker so we can detect accidental mounts
  return <div id="__nf__" data-path={window.location.pathname} style={{display:'none'}} />;
}
