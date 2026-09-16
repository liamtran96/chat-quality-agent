import { ref, onUnmounted } from 'vue'
import api from '../api'

export interface ChatMessage {
  id: string
  sender_type: string
  sender_name: string
  content: string
  content_type?: string
  attachments?: string
  sent_at: string
}

export interface Attachment {
  type?: string
  name?: string
  url?: string
  local_path?: string
}

// Tải và hiển thị diễn biến cuộc chat: nhớ tin nhắn đã tải, tải ảnh đính kèm qua
// header Authorization (ảnh nằm sau endpoint có xác thực nên không đặt thẳng vào src).
export function useChatTranscript() {
  const messages = ref<Record<string, ChatMessage[]>>({})
  const anhCache = ref<Record<string, string>>({})
  const khongCoQuyen = ref(false)

  async function loadMessages(tenantId: string, conversationId: string) {
    if (!conversationId || messages.value[conversationId]) return
    try {
      const { data } = await api.get(`/tenants/${tenantId}/conversations/${conversationId}/messages`)
      const list: ChatMessage[] = data.messages || []
      messages.value[conversationId] = list
      loadImagesForMessages(list)
    } catch (e: any) {
      // Trang Kết quả mở cho quyền "tác vụ", còn tin nhắn là quyền riêng —
      // thiếu quyền thì vẫn xem được phần đánh giá, chỉ giấu phần hội thoại.
      if (e?.response?.status === 403) khongCoQuyen.value = true
      messages.value[conversationId] = []
    }
  }

  function hasAttachments(msg: ChatMessage): boolean {
    if (!msg.attachments || msg.attachments === '[]' || msg.attachments === 'null') return false
    try {
      const arr = JSON.parse(msg.attachments)
      return Array.isArray(arr) && arr.length > 0
    } catch {
      return false
    }
  }

  function parseAttachments(msg: ChatMessage): Attachment[] {
    try {
      return JSON.parse(msg.attachments || '[]') || []
    } catch {
      return []
    }
  }

  function isImageAttachment(att: Attachment): boolean {
    if (!att.type) return false
    const t = att.type.toLowerCase()
    return t.startsWith('image') || t === 'photo' || t === 'gif' || t === 'sticker'
  }

  function getAttachmentUrl(att: Attachment): string {
    if (att.local_path) return `/api/v1/files/${att.local_path}`
    return att.url || ''
  }

  async function loadAuthImage(url: string) {
    if (!url || anhCache.value[url]) return
    if (!url.startsWith('/api/')) {
      anhCache.value[url] = url
      return
    }
    anhCache.value[url] = 'loading'
    try {
      const token = localStorage.getItem('cqa_access_token')
      const resp = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (resp.ok) {
        anhCache.value[url] = URL.createObjectURL(await resp.blob())
      } else {
        delete anhCache.value[url]
      }
    } catch {
      delete anhCache.value[url]
    }
  }

  function loadImagesForMessages(list: ChatMessage[]) {
    for (const msg of list) {
      if (!hasAttachments(msg)) continue
      for (const att of parseAttachments(msg)) {
        if (!isImageAttachment(att)) continue
        const url = getAttachmentUrl(att)
        if (url) loadAuthImage(url)
      }
    }
  }

  onUnmounted(() => {
    for (const url of Object.values(anhCache.value)) {
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
    }
  })

  return {
    messages,
    anhCache,
    khongCoQuyen,
    loadMessages,
    hasAttachments,
    parseAttachments,
    isImageAttachment,
    getAttachmentUrl,
  }
}
