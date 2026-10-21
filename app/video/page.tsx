import type {Metadata} from "next";
import AgentVideoStudio from "@/components/agent-video-studio";
export const metadata:Metadata={title:"AGENT | استوديو صناعة الفيديو",description:"إنشاء فيديوهات متعددة المشاهد من النصوص والصور والصوت داخل المتصفح دون اشتراك أو إرسال بيانات."};
export default function VideoPage(){return <AgentVideoStudio/>;}
