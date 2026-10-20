import type {Metadata} from "next";
import AssistantLibrary from "@/components/assistant-library";

export const metadata:Metadata={
  title:"AGENT | المكتبة",
  description:"الملفات والمستندات والوسائط ونتائج المحادثات المحفوظة في AGENT."
};
export default function LibraryPage(){return <AssistantLibrary/>;}
