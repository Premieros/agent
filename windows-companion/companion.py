"""Premier AGENT Windows Companion — explicit-consent desktop automation.

Install: py -m pip install -r requirements.txt
Run: py companion.py
No unattended shell execution, screen streaming, or background startup.
"""
import json
import queue
import threading
import time
import urllib.error
import urllib.request
import webbrowser
import tkinter as tk
from tkinter import messagebox, ttk

BASE_URL = "https://premieros-ai-sales-agent-git-feature-3d3de3-sayedalaa82285-7634.vercel.app"
ALLOWED_ACTIONS = {"open_url", "click", "type_text", "hotkey"}
EVENTS: "queue.Queue[tuple[str, object]]" = queue.Queue()


def request(endpoint: str, token: str, payload: dict) -> dict:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        BASE_URL + endpoint, data=body,
        headers={"Content-Type": "application/json", "X-Desktop-Token": token},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))


def perform(job: dict, root: tk.Tk) -> str:
    action = job.get("action")
    args = job.get("arguments", {})
    if action not in ALLOWED_ACTIONS or not isinstance(args, dict):
        raise ValueError("Unsupported command")
    if action == "open_url":
        from urllib.parse import urlsplit
        url = args["url"]
        parts = urlsplit(url)
        if parts.scheme != "https" or parts.username or parts.password:
            raise ValueError("Only HTTPS links are allowed")
        webbrowser.open(url, new=2)
        return "Browser opened"
    import pyautogui
    pyautogui.FAILSAFE = True
    pyautogui.PAUSE = 0.12
    if action == "click":
        x, y = args["x"], args["y"]
        if not isinstance(x, int) or not isinstance(y, int):
            raise ValueError("Invalid coordinates")
        pyautogui.click(x=x, y=y)
        return "Clicked"
    if action == "type_text":
        text = args["text"]
        if not isinstance(text, str) or not text or len(text) > 1200:
            raise ValueError("Invalid text")
        # Windows Unicode paste; user has already approved this action.
        # This intentionally replaces the system clipboard.
        root.clipboard_clear()
        root.clipboard_append(text)
        root.update()
        pyautogui.hotkey("ctrl", "v")
        return "Text pasted (clipboard replaced)"
    if action == "hotkey":
        keys = args["keys"]
        allowed = {"enter", "tab", "esc", "ctrl", "alt", "shift", "win",
                   "c", "v", "a", "t", "w", "l", "f", "s",
                   "left", "right", "up", "down", "backspace"}
        if not isinstance(keys, list) or not 1 <= len(keys) <= 4 or any(k not in allowed for k in keys):
            raise ValueError("Invalid hotkey")
        pyautogui.hotkey(*keys)
        return "Shortcut sent"
    raise ValueError("Unsupported command")


class Companion:
    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.title("Premier AGENT | Windows Companion")
        self.root.geometry("560x390")
        self.root.resizable(False, False)
        self.root.protocol("WM_DELETE_WINDOW", self.close)
        self.running = threading.Event()
        self.worker: threading.Thread | None = None
        self.token = tk.StringVar()
        self.status = tk.StringVar(value="غير متصل — في انتظار بدء الاتصال")
        panel = ttk.Frame(self.root, padding=18)
        panel.pack(fill="both", expand=True)
        ttk.Label(panel, text="Premier AGENT — التحكم بموافقتك", font=("Segoe UI", 16, "bold")).pack(anchor="w")
        ttk.Label(panel, text="انسخ رمز الجهاز من صفحة الأجهزة في AGENT، ثم الصقه هنا.").pack(anchor="w", pady=(10, 4))
        ttk.Entry(panel, textvariable=self.token, show="•", width=72).pack(anchor="w", fill="x")
        ttk.Label(panel, text="الرمز يبقى في الذاكرة فقط ولا يُحفظ على القرص.").pack(anchor="w", pady=4)
        row = ttk.Frame(panel)
        row.pack(anchor="w", pady=12)
        self.start_button = ttk.Button(row, text="بدء الاستقبال", command=self.start)
        self.start_button.pack(side="left")
        ttk.Button(row, text="إيقاف فورًا", command=self.stop).pack(side="left", padx=8)
        ttk.Label(panel, textvariable=self.status, wraplength=500).pack(anchor="w", pady=6)
        self.log = tk.Text(panel, height=8, state="disabled", wrap="word")
        self.log.pack(fill="both", expand=True, pady=8)
        ttk.Label(panel, text="كل أمر يتطلب موافقتك. حرّك المؤشر إلى زاوية الشاشة لإيقاف PyAutoGUI.").pack(anchor="w")
        self.root.after(150, self.process_events)

    def append(self, message: str) -> None:
        self.log.configure(state="normal")
        self.log.insert("end", time.strftime("%H:%M:%S ") + message + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")

    def start(self) -> None:
        token = self.token.get().strip().lower()
        if len(token) != 64 or any(x not in "0123456789abcdef" for x in token):
            messagebox.showerror("رمز غير صحيح", "أدخل الرمز الكامل المكوّن من 64 خانة.")
            return
        if self.running.is_set():
            return
        self.running.set()
        self.start_button.configure(state="disabled")
        self.status.set("جاري الاتصال…")
        self.worker = threading.Thread(target=self.poll_loop, args=(token,), daemon=True)
        self.worker.start()

    def stop(self) -> None:
        self.running.clear()
        self.status.set("متوقف — لا تُستقبل أوامر جديدة")
        self.start_button.configure(state="normal")

    def close(self) -> None:
        self.stop()
        self.token.set("")
        self.root.destroy()

    def poll_loop(self, token: str) -> None:
        while self.running.is_set():
            try:
                data = request("/api/desktop/agent", token, {"action": "poll"})
                EVENTS.put(("status", "متصل — ينتظر الأوامر"))
                job = data.get("job")
                if job:
                    # A single in-flight command; do not poll another until completed.
                    approved = threading.Event()
                    decision = {"ok": False}
                    EVENTS.put(("approve", (job, approved, decision)))
                    while self.running.is_set() and not approved.wait(0.2):
                        pass
                    status, result = "rejected", "Rejected on device"
                    if self.running.is_set() and decision["ok"]:
                        try:
                            # Execution is scheduled on Tk main thread for clipboard safety.
                            finished = threading.Event()
                            outcome = {"status": "failed", "result": "Execution interrupted"}
                            EVENTS.put(("perform", (job, finished, outcome)))
                            while self.running.is_set() and not finished.wait(0.2):
                                pass
                            status, result = outcome["status"], outcome["result"]
                        except Exception as ex:
                            status, result = "failed", str(ex)[:250]
                    try:
                        request("/api/desktop/agent", token, {
                            "action": "complete", "jobId": job["id"], "status": status, "result": result
                        })
                    except Exception as ex:
                        EVENTS.put(("log", "تعذّر تأكيد نتيجة الأمر: " + str(ex)[:100]))
            except urllib.error.HTTPError as error:
                if error.code == 401:
                    EVENTS.put(("log", "رمز الجهاز مرفوض أو تم إلغاؤه."))
                    EVENTS.put(("stop", None))
                    break
                EVENTS.put(("status", "تعذّر الاتصال بالخادم (" + str(error.code) + ")"))
            except Exception as error:
                EVENTS.put(("status", "تعذّر الاتصال مؤقتًا: " + str(error)[:80]))
            # Short, cancellable polling delay.
            for _ in range(20):
                if not self.running.is_set():
                    break
                time.sleep(0.25)

    def process_events(self) -> None:
        try:
            while True:
                kind, value = EVENTS.get_nowait()
                if kind == "status":
                    self.status.set(str(value))
                elif kind == "log":
                    self.append(str(value))
                elif kind == "stop":
                    self.stop()
                elif kind == "approve":
                    job, event, decision = value
                    description = json.dumps(job.get("arguments", {}), ensure_ascii=False)[:400]
                    decision["ok"] = self.running.is_set() and messagebox.askyesno(
                        "موافقة محلية مطلوبة",
                        "هل تسمح بتنفيذ الأمر التالي على هذا الكمبيوتر؟\n\n"
                        + str(job.get("action")) + "\n" + description
                    )
                    self.append(("تمت الموافقة: " if decision["ok"] else "تم الرفض: ") + str(job.get("action")))
                    event.set()
                elif kind == "perform":
                    job, event, result = value
                    try:
                        result["result"] = perform(job, self.root)
                        result["status"] = "completed"
                    except Exception as error:
                        result["result"] = str(error)[:250]
                        result["status"] = "failed"
                    self.append(result["status"] + ": " + result["result"])
                    event.set()
        except queue.Empty:
            pass
        if self.root.winfo_exists():
            self.root.after(150, self.process_events)

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    Companion().run()
