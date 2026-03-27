import { ChatMessage, BatchItem } from './providers/ai-provider.interface';

export function buildQCPrompt(
  rulesContent: string,
  skipConditions?: string,
): string {
  let skipSection = '';
  if (skipConditions) {
    skipSection = `
## \u0110i\u1EC1u ki\u1EC7n b\u1ECF qua (kh\u00F4ng \u0111\u00E1nh gi\u00E1):
${skipConditions}

N\u1EBFu cu\u1ED9c chat th\u1ECFa m\u00E3n b\u1EA5t k\u1EF3 \u0111i\u1EC1u ki\u1EC7n n\u00E0o tr\u00EAn, tr\u1EA3 v\u1EC1 verdict="SKIP", violations=[], score=0, review=l\u00FD do b\u1ECF qua ng\u1EAFn g\u1ECDn.
`;
  }

  return `B\u1EA1n l\u00E0 chuy\u00EAn gia \u0111\u00E1nh gi\u00E1 ch\u1EA5t l\u01B0\u1EE3ng ch\u0103m s\u00F3c kh\u00E1ch h\u00E0ng (CSKH).

## Quy \u0111\u1ECBnh CSKH c\u1EA7n tu\u00E2n th\u1EE7:
${rulesContent}
${skipSection}
## Nhi\u1EC7m v\u1EE5:
Ph\u00E2n t\u00EDch \u0111o\u1EA1n chat CSKH d\u01B0\u1EDBi \u0111\u00E2y v\u00E0 t\u00ECm c\u00E1c vi ph\u1EA1m quy \u0111\u1ECBnh.

## Y\u00EAu c\u1EA7u output:
Tr\u1EA3 v\u1EC1 JSON v\u1EDBi c\u1EA5u tr\u00FAc sau:
{
  "verdict": "PASS", "FAIL" ho\u1EB7c "SKIP",
  "score": 0-100,
  "review": "Nh\u1EADn x\u00E9t t\u1ED5ng quan cu\u1ED9c chat: chat t\u1ED1t hay ch\u01B0a t\u1ED1t, c\u1EA7n c\u1EA3i thi\u1EC7n \u0111i\u1EC1u g\u00EC",
  "violations": [
    {
      "severity": "NGHIEM_TRONG" ho\u1EB7c "CAN_CAI_THIEN",
      "rule": "T\u00EAn quy t\u1EAFc b\u1ECB vi ph\u1EA1m",
      "evidence": "Tr\u00EDch d\u1EABn ch\u00EDnh x\u00E1c \u0111o\u1EA1n chat vi ph\u1EA1m",
      "explanation": "Gi\u1EA3i th\u00EDch ng\u1EAFn g\u1ECDn t\u1EA1i sao \u0111\u00E2y l\u00E0 vi ph\u1EA1m",
      "suggestion": "G\u1EE3i \u00FD c\u00E1ch tr\u1EA3 l\u1EDDi \u0111\u00FAng"
    }
  ],
  "summary": "T\u1ED5ng quan ng\u1EAFn g\u1ECDn v\u1EC1 ch\u1EA5t l\u01B0\u1EE3ng chat"
}

- "verdict": "PASS" n\u1EBFu cu\u1ED9c chat \u0111\u1EA1t y\u00EAu c\u1EA7u ch\u1EA5t l\u01B0\u1EE3ng, "FAIL" n\u1EBFu c\u00F3 v\u1EA5n \u0111\u1EC1 c\u1EA7n kh\u1EAFc ph\u1EE5c, "SKIP" n\u1EBFu th\u1ECFa \u0111i\u1EC1u ki\u1EC7n b\u1ECF qua
- "review": Nh\u1EADn x\u00E9t chi ti\u1EBFt v\u1EC1 cu\u1ED9c chat (2-3 c\u00E2u), \u0111\u00E1nh gi\u00E1 ch\u1EA5t l\u01B0\u1EE3ng ch\u0103m s\u00F3c kh\u00E1ch h\u00E0ng
- N\u1EBFu kh\u00F4ng c\u00F3 vi ph\u1EA1m: verdict="PASS", violations=[], score g\u1EA7n 100
- N\u1EBFu c\u00F3 vi ph\u1EA1m nghi\u00EAm tr\u1ECDng: verdict="FAIL"
CH\u1EC8 tr\u1EA3 v\u1EC1 JSON, kh\u00F4ng th\u00EAm text kh\u00E1c.`;
}

export function buildClassificationPrompt(rulesConfigJSON: string): string {
  return `B\u1EA1n l\u00E0 h\u1EC7 th\u1ED1ng ph\u00E2n lo\u1EA1i n\u1ED9i dung h\u1ED9i tho\u1EA1i CSKH/Sales.

## C\u00E1c quy t\u1EAFc ph\u00E2n lo\u1EA1i:
${rulesConfigJSON}

## Nhi\u1EC7m v\u1EE5:
Ph\u00E2n t\u00EDch \u0111o\u1EA1n chat d\u01B0\u1EDBi \u0111\u00E2y v\u00E0 g\u00E1n c\u00E1c nh\u00E3n ph\u00E2n lo\u1EA1i ph\u00F9 h\u1EE3p.

## Y\u00EAu c\u1EA7u output:
Tr\u1EA3 v\u1EC1 JSON:
{
  "tags": [
    {
      "rule_name": "T\u00EAn rule \u0111\u00E3 match",
      "confidence": 0.0-1.0,
      "evidence": "Tr\u00EDch d\u1EABn \u0111o\u1EA1n chat li\u00EAn quan",
      "explanation": "Gi\u1EA3i th\u00EDch ng\u1EAFn g\u1ECDn t\u1EA1i sao"
    }
  ],
  "summary": "M\u00F4 t\u1EA3 chi ti\u1EBFt n\u1ED9i dung cu\u1ED9c chat: kh\u00E1ch h\u00E0ng n\u00F3i g\u00EC, nh\u00E2n vi\u00EAn x\u1EED l\u00FD ra sao, k\u1EBFt qu\u1EA3 th\u1EBF n\u00E0o (2-3 c\u00E2u, KH\u00D4NG l\u1EB7p l\u1EA1i t\u00EAn nh\u00E3n ph\u00E2n lo\u1EA1i)"
}

- "summary" ph\u1EA3i m\u00F4 t\u1EA3 C\u1EE4 TH\u1EC2 n\u1ED9i dung cu\u1ED9c chat, kh\u00F4ng \u0111\u01B0\u1EE3c vi\u1EBFt chung chung nh\u01B0 "Cu\u1ED9c chat \u0111\u01B0\u1EE3c ph\u00E2n lo\u1EA1i: X"
- V\u00ED d\u1EE5 t\u1ED1t: "Kh\u00E1ch h\u00E0ng h\u1ECFi v\u1EC1 t\u00EDnh n\u0103ng webhook nh\u01B0ng nh\u00E2n vi\u00EAn kh\u00F4ng n\u1EAFm r\u00F5, h\u01B0\u1EDBng d\u1EABn sai c\u00E1ch c\u1EA5u h\u00ECnh. Kh\u00E1ch ph\u1EA3n h\u1ED3i ti\u00EAu c\u1EF1c."
- V\u00ED d\u1EE5 x\u1EA5u: "Cu\u1ED9c chat \u0111\u01B0\u1EE3c ph\u00E2n lo\u1EA1i: G\u00F3p \u00FD t\u00EDnh n\u0103ng"
CH\u1EC8 tr\u1EA3 v\u1EC1 JSON, kh\u00F4ng th\u00EAm text kh\u00E1c.`;
}

/** Format: [HH:mm] SenderName: content -- falls back to senderType when name is empty. */
export function formatChatTranscript(messages: ChatMessage[]): string {
  let result = '';
  for (const msg of messages) {
    const label = msg.senderName || msg.senderType;
    result += `[${msg.sentAt}] ${label}: ${msg.content}\n`;
  }
  return result;
}

export function wrapBatchPrompt(basePrompt: string, count: number): string {
  return `${basePrompt}

QUAN TR\u1ECENG: B\u1EA1n s\u1EBD nh\u1EADn \u0111\u01B0\u1EE3c ${count} cu\u1ED9c h\u1ED9i tho\u1EA1i, m\u1ED7i cu\u1ED9c \u0111\u01B0\u1EE3c \u0111\u00E1nh d\u1EA5u "=== CU\u1ED8C H\u1ED8I THO\u1EA0I N (ID: xxx) ===".
Tr\u1EA3 v\u1EC1 JSON ARRAY ch\u1EE9a ${count} ph\u1EA7n t\u1EED, m\u1ED7i ph\u1EA7n t\u1EED l\u00E0 k\u1EBFt qu\u1EA3 \u0111\u00E1nh gi\u00E1 cho 1 cu\u1ED9c h\u1ED9i tho\u1EA1i theo \u0111\u00FAng th\u1EE9 t\u1EF1.
Format: [{"conversation_id": "xxx", ...k\u1EBFt qu\u1EA3...}, ...]
CH\u1EC8 tr\u1EA3 v\u1EC1 JSON array, kh\u00F4ng th\u00EAm text kh\u00E1c.`;
}

export function formatBatchTranscript(items: BatchItem[]): string {
  let result = '';
  for (let i = 0; i < items.length; i++) {
    result += `=== CU\u1ED8C H\u1ED8I THO\u1EA0I ${i + 1} (ID: ${items[i].conversationId}) ===\n${items[i].transcript}\n\n`;
  }
  return result;
}
