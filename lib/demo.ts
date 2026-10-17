export type Channel = "whatsapp" | "messenger" | "facebook_comment";
export type Segment = "restaurant" | "clothing";
export type Priority = "hot" | "warm" | "cold";
export type Mode = "ai" | "human";
export type Stage = "new" | "qualifying" | "qualified" | "contacting" | "site_visit" | "proposal" | "won" | "lost";
export type HandoffType = "chat" | "call" | null;

export type Lead = {
  id: string;
  name: string;
  businessName: string;
  segment: Segment;
  businessType: string;
  phone: string;
  city: string;
  branches: string;
  requirements: string;
  priority: Priority;
  stage: Stage;
  source: Channel;
  lastActivity: string;
  summary: string;
  preferredContact: "chat" | "phone" | "either";
};

export type Message = {
  id: string;
  author: "customer" | "ai" | "employee" | "system";
  body: string;
  time: string;
};

export type Conversation = {
  id: string;
  leadId: string;
  mode: Mode;
  handoff: HandoffType;
  unread: number;
  messages: Message[];
};

export const stageLabels: Record<Stage, string> = {
  new: "جديد",
  qualifying: "تأهيل العميل",
  qualified: "مؤهل",
  contacting: "تواصل بشري",
  site_visit: "معاينة",
  proposal: "عرض سعر",
  won: "تم التعاقد",
  lost: "لم تتم الصفقة"
};

export const channelLabels: Record<Channel, string> = {
  whatsapp: "واتساب",
  messenger: "ماسنجر",
  facebook_comment: "تعليق فيسبوك"
};

export const priorityLabels: Record<Priority, string> = {
  hot: "ساخن",
  warm: "متوسط",
  cold: "بارد"
};

export const sampleLeads: Lead[] = [
  {
    id: "lead-1", name: "أحمد محمود", businessName: "مطاعم النخبة",
    segment: "restaurant", businessType: "مطعم", phone: "0100 XXX XXXX",
    city: "الإسكندرية", branches: "3 فروع",
    requirements: "5 نقاط بيع، إدارة مخازن، طابعات مطبخ وهاردوير",
    priority: "hot", stage: "qualified", source: "whatsapp", lastActivity: "منذ 4 دقائق",
    summary: "العميل جاد، لديه ثلاثة فروع ويطلب معاينة لتحديد الأجهزة والتكلفة النهائية. يفضل اتصالًا هاتفيًا لتنسيق الزيارة.",
    preferredContact: "phone"
  },
  {
    id: "lead-2", name: "سارة حسن", businessName: "مصنع الأناقة للملابس",
    segment: "clothing", businessType: "مصنع ملابس", phone: "0112 XXX XXXX",
    city: "القاهرة", branches: "مصنع + مخزنان",
    requirements: "متابعة الإنتاج والمخازن والفواتير والباركود",
    priority: "hot", stage: "qualified", source: "messenger", lastActivity: "منذ 12 دقيقة",
    summary: "تحتاج عرضًا يشرح المخازن وربط مراحل الإنتاج. طلبت متابعة التفاصيل كتابةً قبل تحديد زيارة.",
    preferredContact: "chat"
  },
  {
    id: "lead-3", name: "محمد علي", businessName: "كافيه المدينة",
    segment: "restaurant", businessType: "كافيه", phone: "0120 XXX XXXX",
    city: "الجيزة", branches: "فرع واحد",
    requirements: "نقطتا بيع، طابعة مطبخ، تقارير مبيعات",
    priority: "warm", stage: "qualifying", source: "facebook_comment", lastActivity: "منذ 25 دقيقة",
    summary: "يسأل عن الأسعار ويقارن البدائل. ما زال الأيجنت يجمع احتياجاته.",
    preferredContact: "either"
  },
  {
    id: "lead-4", name: "منى يوسف", businessName: "متجر ستايل",
    segment: "clothing", businessType: "محل ملابس", phone: "0155 XXX XXXX",
    city: "طنطا", branches: "فرعان",
    requirements: "باركود، مقاسات وألوان، جرد وربط الفروع",
    priority: "warm", stage: "new", source: "whatsapp", lastActivity: "منذ ساعة",
    summary: "عميلة جديدة مهتمة بربط الفرعين ومتابعة المقاسات والألوان.",
    preferredContact: "chat"
  }
];

export const sampleConversations: Conversation[] = [
  {
    id: "thread-1", leadId: "lead-1", mode: "ai", handoff: null, unread: 2,
    messages: [
      { id: "a1", author: "customer", body: "مساء الخير، محتاج نظام لمطعم عندي 3 فروع. هل بتوفروا الأجهزة كمان؟", time: "4:20 م" },
      { id: "a2", author: "ai", body: "أهلًا بحضرتك! أيوه، بنقدر نحدد احتياج الهاردوير بعد معاينة الموقع. ممكن أعرف عدد نقاط البيع وطابعات المطبخ؟", time: "4:21 م" },
      { id: "a3", author: "customer", body: "غالبًا 5 نقاط بيع. محتاج حد يكلمني ويشوف المكان.", time: "4:23 م" },
      { id: "a4", author: "ai", body: "تمام، هجهز بيانات حضرتك لموظف المبيعات علشان يرتب مكالمة ومعاينة، من غير ما أحدد سعر أجهزة قبل المعاينة.", time: "4:24 م" }
    ]
  },
  {
    id: "thread-2", leadId: "lead-2", mode: "ai", handoff: null, unread: 1,
    messages: [
      { id: "b1", author: "customer", body: "ممكن أعرف البرنامج بيدعم إدارة مصنع ملابس ومخازن؟", time: "4:08 م" },
      { id: "b2", author: "ai", body: "أقدر أوضح لحضرتك المميزات المتاحة بعد مراجعة متطلبات المصنع. هل عندكم مخازن منفصلة عن الإنتاج؟", time: "4:09 م" },
      { id: "b3", author: "customer", body: "عندنا مخزنين. أفضل حد من الفريق يكمل معايا هنا في الشات.", time: "4:12 م" }
    ]
  },
  {
    id: "thread-3", leadId: "lead-3", mode: "ai", handoff: null, unread: 0,
    messages: [
      { id: "c1", author: "customer", body: "بكام نظام الكافيه؟", time: "3:42 م" },
      { id: "c2", author: "ai", body: "أهلًا بحضرتك. السعر بيتحدد حسب عدد نقاط البيع والمميزات والأجهزة المطلوبة. حضرتك عندك فرع واحد ولا أكتر؟", time: "3:44 م" }
    ]
  },
  {
    id: "thread-4", leadId: "lead-4", mode: "ai", handoff: null, unread: 1,
    messages: [
      { id: "d1", author: "customer", body: "عندي محلين ملابس وعايزة أعرف نظام الباركود وربط الفروع.", time: "3:02 م" },
      { id: "d2", author: "ai", body: "يسعدني أساعد حضرتك. محتاجين نعرف عدد الأصناف والمقاسات والألوان علشان نرشح التكوين المناسب.", time: "3:04 م" }
    ]
  }
];
