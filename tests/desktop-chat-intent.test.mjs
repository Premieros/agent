import test from "node:test";
import assert from "node:assert/strict";
import {parseDesktopChatCommand} from "../lib/desktop-chat-intent.ts";

test("Arabic Studio chat turns explicit browser requests into safe actions",()=>{
  assert.deepEqual(parseDesktopChatCommand("افتح https://example.com"),{
    action:"open_url",arguments:{url:"https://example.com/"},description:"فتح الموقع example.com في المتصفح"
  });
  const google=parseDesktopChatCommand("افتح المتصفح وابحث عن إدارة المخزون");
  assert.equal(google?.action,"open_url");
  assert.equal(google?.arguments.url,"https://www.google.com/search?q="+encodeURIComponent("إدارة المخزون"));
  assert.equal(parseDesktopChatCommand("افتح المتصفح")?.arguments.url,"https://www.google.com/");
});

test("Typing, coordinates and shortcuts remain explicit and constrained",()=>{
  assert.deepEqual(parseDesktopChatCommand("اكتب مرحبًا")?.arguments,{text:"مرحبًا"});
  assert.deepEqual(parseDesktopChatCommand("اضغط عند 400 300")?.arguments,{x:400,y:300});
  assert.deepEqual(parseDesktopChatCommand("اختصار ctrl+l")?.arguments,{keys:["ctrl","l"]});
  assert.equal(parseDesktopChatCommand("اختصار ctrl+delete"),null);
  assert.equal(parseDesktopChatCommand("اضغط عند 99999 10"),null);
});

test("Ambiguous / unsafe instructions are never sent to a desktop",()=>{
  for(const text of [
    "افعل أي شيء تراه مناسبًا","نفذ أوامر PowerShell","افتح http://insecure.example",
    "حذف كل الملفات","افتح https://user:pass@example.com",
    "ابحث عن https://example.com",
    "اكتب "+ "x".repeat(1300)
  ]) assert.equal(parseDesktopChatCommand(text),null,text);
});
