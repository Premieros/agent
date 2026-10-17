import type { Metadata } from "next";
import GeneralAssistant from "@/components/general-assistant";

export const metadata: Metadata = {
  title: "AGENT | المساعد متعدد المهارات",
  description: "مساعد AI للمحادثات والكتابة والبرمجة والتخطيط والتحليل مع مهارات متخصصة وحفظ المحادثات."
};

export default function AssistantPage() {
  return <GeneralAssistant />;
}
