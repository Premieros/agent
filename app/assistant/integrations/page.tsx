import type { Metadata } from "next";
import AssistantIntegrationsHub from "@/components/assistant-integrations-hub";
export const metadata:Metadata={
  title:"AGENT | مركز الإضافات والاتصالات",
  description:"إدارة الإضافات ومعلومات الربط ومفاتيح API ومرحلة الصلاحيات داخل AGENT."
};
export default function IntegrationsPage(){return <AssistantIntegrationsHub/>;}
