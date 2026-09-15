<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-6">{{ $t('settings') }}</h1>

    <v-row>
      <v-col cols="12" md="3">
        <v-card class="pa-2">
          <v-list density="compact" nav>
            <v-list-item
              v-for="tab in tabs"
              :key="tab.value"
              :active="activeTab === tab.value"
              :prepend-icon="tab.icon"
              :title="$t(tab.label)"
              rounded="lg"
              color="primary"
              @click="activeTab = tab.value"
            />
          </v-list>
        </v-card>
      </v-col>

      <v-col cols="12" md="9">
        <!-- AI Config -->
        <v-card v-if="activeTab === 'ai'" class="pa-6">
          <div class="text-subtitle-1 font-weight-bold mb-4">
            <v-icon start size="small">mdi-robot</v-icon>
            {{ $t('ai_config') }}
          </div>

          <v-select
            v-model="aiSettings.provider"
            :label="$t('ai_provider')"
            :items="providerOptions"
            class="mb-3"
            @update:model-value="onProviderChange"
          />

          <div class="d-flex align-start ga-2 mb-3">
            <v-select
              v-model="aiSettings.model"
              :label="$t('ai_model')"
              :items="modelOptions"
              hide-details="auto"
              class="flex-grow-1"
            />
            <v-btn
              icon="mdi-refresh"
              variant="text"
              size="small"
              class="mt-2"
              :loading="refreshingModels"
              :title="$t('refresh_model_list')"
              @click="refreshModelList"
            />
          </div>
          <div v-if="modelsSource === 'static'" class="text-caption text-grey mb-3">
            {{ $t('model_list_static') }}
          </div>

          <v-text-field
            v-model="aiSettings.apiKey"
            :label="$t('api_key')"
            :type="showKey ? 'text' : 'password'"
            :append-inner-icon="showKey ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showKey = !showKey"
            class="mb-3"
          />

          <v-switch
            v-model="useCustomBaseUrl"
            label="Tùy chỉnh API URL"
            color="primary"
            density="compact"
            hide-details
            class="mt-1 mb-2"
          />
          <div v-if="!useCustomBaseUrl" class="text-caption text-grey mb-2">Bật khi cần dùng proxy (OpenRouter, LiteLLM) hoặc self-hosted</div>

          <v-text-field
            v-if="useCustomBaseUrl"
            v-model="aiSettings.baseUrl"
            label="Base URL"
            :placeholder="aiSettings.provider === 'claude' ? 'https://api.anthropic.com' : 'https://generativelanguage.googleapis.com'"
            hint="Để trống để dùng mặc định"
            persistent-hint
            clearable
            :rules="[
              v => !!v || 'Vui lòng nhập URL hoặc tắt tùy chỉnh',
              v => !v || v.startsWith('http://') || v.startsWith('https://') || 'URL phải bắt đầu bằng http:// hoặc https://',
            ]"
            class="mb-3"
          />

          <div class="d-flex ga-2">
            <v-btn color="primary" :loading="savingAI" @click="saveAI">{{ $t('save_settings') }}</v-btn>
            <v-btn variant="outlined" :loading="testingKey" @click="testKey">{{ $t('test_api_key') }}</v-btn>
          </div>
        </v-card>

        <!-- General -->
        <!-- Analysis Settings -->
        <v-card v-if="activeTab === 'analysis'" class="pa-6">
          <div class="text-subtitle-1 font-weight-bold mb-4">
            <v-icon start size="small">mdi-chart-bar</v-icon>
            Cài đặt phân tích
          </div>

          <div class="text-subtitle-2 mb-2">Chế độ Batch (tối ưu chi phí)</div>
          <v-switch
            v-model="aiSettings.batchMode"
            label="Bật chế độ Batch"
            hint="Gom nhiều cuộc chat vào 1 lần gọi AI. Tiết kiệm token nhưng có thể giảm độ chính xác."
            persistent-hint
            density="compact"
            color="primary"
            class="mb-3"
          />
          <v-select
            v-if="aiSettings.batchMode"
            v-model="aiSettings.batchSize"
            label="Số cuộc chat / batch"
            :items="[3, 5, 10, 15, 20, 30]"
            density="compact"
            class="mb-4"
            style="max-width: 200px"
          />

          <v-btn color="primary" :loading="savingAnalysis" @click="saveAnalysis">Lưu cài đặt</v-btn>
        </v-card>

        <!-- General -->
        <v-card v-if="activeTab === 'general'" class="pa-6">
          <div class="text-subtitle-1 font-weight-bold mb-4">
            <v-icon start size="small">mdi-cog</v-icon>
            {{ $t('general') }}
          </div>

          <v-text-field v-model="generalSettings.companyName" :label="$t('company_name')" class="mb-3" />
          <v-select
            v-model="generalSettings.timezone"
            :label="$t('timezone')"
            :items="['Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'UTC', 'America/New_York']"
            class="mb-3"
          />
          <v-select
            v-model="generalSettings.language"
            :label="$t('language')"
            :items="[{ title: 'Tiếng Việt', value: 'vi' }, { title: 'English', value: 'en' }]"
            class="mb-3"
          />

          <v-text-field
            v-model.number="generalSettings.exchangeRate"
            :label="$t('exchange_rate_vnd')"
            type="number"
            suffix="VND = 1 USD"
            class="mb-3"
          />

          <v-text-field
            v-model="generalSettings.appUrl"
            label="URL ứng dụng"
            placeholder="https://cqa.yourdomain.com"
            hint="Cấu hình URL để hệ thống gửi link chính xác qua Telegram và Email"
            persistent-hint
            :rules="appUrlRules"
            class="mb-3"
          />

          <v-btn color="primary" :loading="savingGeneral" @click="saveGeneral">{{ $t('save_settings') }}</v-btn>
        </v-card>
      </v-col>
    </v-row>

    <v-snackbar v-model="snackbar" :color="snackColor" timeout="3000">{{ snackText }}</v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import api from '../api'

const route = useRoute()
const { t } = useI18n()
const tenantId = computed(() => route.params.tenantId as string)

const activeTab = ref('ai')
const showKey = ref(false)
const snackbar = ref(false)
const snackText = ref('')
const snackColor = ref('success')

const savingAI = ref(false)
const testingKey = ref(false)
const savingGeneral = ref(false)

const tabs = [
  { label: 'ai_config', value: 'ai', icon: 'mdi-robot' },
  { label: 'analysis_settings', value: 'analysis', icon: 'mdi-chart-bar' },
  { label: 'general', value: 'general', icon: 'mdi-cog' },
]

// Danh sách đối chiếu ngày 2026-09-15. Model thế hệ cũ vẫn giữ lại để ai đang
// dùng không bị mất lựa chọn, nhưng ghi rõ là cũ.
const claudeModels = [
  { title: 'Claude Sonnet 5 (Khuyến nghị)', value: 'claude-sonnet-5' },
  { title: 'Claude Haiku 4.5 (Nhanh & rẻ)', value: 'claude-haiku-4-5' },
  { title: 'Claude Opus 5 (Mạnh nhất)', value: 'claude-opus-5' },
  { title: 'Claude Sonnet 4.6 (Thế hệ cũ)', value: 'claude-sonnet-4-6' },
  { title: 'Claude Opus 4.6 (Thế hệ cũ)', value: 'claude-opus-4-6' },
]
const providerOptions = [
  { title: 'Claude (Anthropic)', value: 'claude' },
  { title: 'Gemini (Google)', value: 'gemini' },
  { title: 'ChatGPT (OpenAI)', value: 'openai' },
  { title: 'Grok (xAI)', value: 'xai' },
]
const openaiModels = [
  { title: 'GPT-5 (Khuyến nghị)', value: 'gpt-5' },
  { title: 'GPT-5 mini (Nhanh & rẻ)', value: 'gpt-5-mini' },
  { title: 'o3 (Suy luận sâu)', value: 'o3' },
]
const xaiModels = [
  { title: 'Grok 4 (Khuyến nghị)', value: 'grok-4' },
  { title: 'Grok 3 (Thế hệ cũ)', value: 'grok-3' },
]
const geminiModels = [
  { title: 'Gemini 3.8 Flash (Khuyến nghị)', value: 'gemini-3.8-flash' },
  { title: 'Gemini 3.1 Flash Lite (Nhanh & rẻ nhất)', value: 'gemini-3.1-flash-lite' },
  { title: 'Gemini 3.5 Flash Lite (Rẻ)', value: 'gemini-3.5-flash-lite' },
  { title: 'Gemini 3.5 Flash (Mạnh hơn)', value: 'gemini-3.5-flash' },
  { title: 'Gemini 2.5 Pro (Thế hệ cũ)', value: 'gemini-2.5-pro' },
  { title: 'Gemini 2.5 Flash (Thế hệ cũ)', value: 'gemini-2.5-flash' },
]

const useCustomBaseUrl = ref(false)
const hasSavedKey = ref(false)
const aiSettings = reactive({ provider: 'claude', model: 'claude-sonnet-5', apiKey: '', baseUrl: '', batchMode: true, batchSize: 5 })
const generalSettings = reactive({ companyName: '', timezone: 'Asia/Ho_Chi_Minh', language: 'vi', exchangeRate: 26000, appUrl: '' })

const appUrlRules = [
  (v: string) => !v || /^https?:\/\/.+/.test(v) || 'URL phải bắt đầu bằng http:// hoặc https://',
  (v: string) => !v || !v.endsWith('/') || 'URL không nên có dấu / ở cuối',
]

function fallbackModels(provider: string) {
  switch (provider) {
    case 'gemini': return geminiModels
    case 'openai': return openaiModels
    case 'xai': return xaiModels
    default: return claudeModels
  }
}

function defaultModelFor(provider: string) {
  switch (provider) {
    case 'gemini': return 'gemini-3.8-flash'
    case 'openai': return 'gpt-5'
    case 'xai': return 'grok-4'
    default: return 'claude-sonnet-5'
  }
}

// Danh sách lấy từ nhà cung cấp nếu có, không thì dùng danh sách kèm sẵn.
const fetchedModels = ref<{ id: string; title: string }[]>([])
const modelsSource = ref('')
const refreshingModels = ref(false)

const modelOptions = computed(() => {
  if (fetchedModels.value.length) {
    return fetchedModels.value.map(m => ({ title: m.title, value: m.id }))
  }
  const fallback = fallbackModels(aiSettings.provider)
  // Model đang dùng phải luôn có mặt, nếu không ô chọn sẽ hiện trống.
  if (aiSettings.model && !fallback.some(m => m.value === aiSettings.model)) {
    return [{ title: `${aiSettings.model} (đang dùng)`, value: aiSettings.model }, ...fallback]
  }
  return fallback
})

async function loadModelList() {
  try {
    const { data } = await api.get(`/tenants/${tenantId.value}/settings/ai/models`)
    fetchedModels.value = data.models || []
    modelsSource.value = data.source || ''
  } catch {
    // Không lấy được thì im lặng dùng danh sách kèm sẵn
    fetchedModels.value = []
    modelsSource.value = 'static'
  }
}

async function refreshModelList() {
  refreshingModels.value = true
  try {
    const { data } = await api.post(`/tenants/${tenantId.value}/settings/ai/models/refresh`)
    fetchedModels.value = data.models || []
    modelsSource.value = data.source || ''
    showSnack(`Đã cập nhật ${fetchedModels.value.length} model`, 'success')
  } catch (err: any) {
    const res = err.response?.data
    showSnack(res?.message || res?.error || t('error'), 'error')
  } finally {
    refreshingModels.value = false
  }
}

function onProviderChange() {
  // Reset to default model when switching provider
  aiSettings.model = defaultModelFor(aiSettings.provider)
  // Danh sách model của nhà cung cấp cũ không còn đúng nữa
  fetchedModels.value = []
  modelsSource.value = ''
}

async function loadSettings() {
  try {
    const { data } = await api.get(`/tenants/${tenantId.value}/settings`)
    if (data.settings.ai_provider) aiSettings.provider = data.settings.ai_provider
    if (data.settings.ai_model) aiSettings.model = data.settings.ai_model
    if (data.settings.ai_api_key) {
      aiSettings.apiKey = data.settings.ai_api_key
      hasSavedKey.value = true
    }
    if (data.settings.ai_base_url) {
      aiSettings.baseUrl = data.settings.ai_base_url
      useCustomBaseUrl.value = true
    }
    if (data.settings.ai_batch_mode) aiSettings.batchMode = data.settings.ai_batch_mode === 'true'
    if (data.settings.ai_batch_size) aiSettings.batchSize = parseInt(data.settings.ai_batch_size) || 5
    if (data.settings.exchange_rate_vnd) generalSettings.exchangeRate = parseFloat(data.settings.exchange_rate_vnd) || 26000
    if (data.settings.app_url) generalSettings.appUrl = data.settings.app_url
    if (data.tenant) {
      generalSettings.companyName = data.tenant.name || ''
      generalSettings.timezone = data.tenant.timezone || 'Asia/Ho_Chi_Minh'
      generalSettings.language = data.tenant.language || 'vi'
    }
  } catch {
    // Settings not yet saved
  }
}

const savingAnalysis = ref(false)

async function saveAnalysis() {
  savingAnalysis.value = true
  try {
    await api.put(`/tenants/${tenantId.value}/settings/analysis`, {
      batch_mode: aiSettings.batchMode ? 'true' : 'false',
      batch_size: String(aiSettings.batchSize),
    })
    showSnack(t('success'), 'success')
  } catch (err: any) {
    showSnack(err.response?.data?.error || t('error'), 'error')
  } finally {
    savingAnalysis.value = false
  }
}

async function saveAI() {
  // Ô key hiển thị dấu chấm khi đã có key lưu sẵn. Gửi chuỗi rỗng để backend
  // giữ nguyên key cũ, nhờ vậy đổi model hay cỡ lô không phải nhập lại key.
  const apiKeyToSend = aiSettings.apiKey === '••••••••' ? '' : aiSettings.apiKey
  if (!apiKeyToSend && !hasSavedKey.value) {
    showSnack('Vui lòng nhập API Key', 'error')
    return
  }
  if (useCustomBaseUrl.value && !aiSettings.baseUrl) {
    showSnack('Vui lòng nhập Base URL hoặc tắt tùy chỉnh', 'error')
    return
  }
  savingAI.value = true
  try {
    await api.put(`/tenants/${tenantId.value}/settings/ai`, {
      provider: aiSettings.provider,
      model: aiSettings.model,
      api_key: apiKeyToSend,
      base_url: useCustomBaseUrl.value ? (aiSettings.baseUrl || '') : '',
      batch_mode: aiSettings.batchMode ? 'true' : 'false',
      batch_size: String(aiSettings.batchSize),
    })
    showSnack(t('success'), 'success')
  } catch (err: any) {
    showSnack(err.response?.data?.error || t('error'), 'error')
  } finally {
    savingAI.value = false
  }
}

async function testKey() {
  testingKey.value = true
  try {
    const { data } = await api.post(`/tenants/${tenantId.value}/settings/ai/test`)
    const detail = data.model ? `${data.provider} / ${data.model}` : data.provider
    showSnack(`${detail}: ${data.message}`, 'success')
  } catch (err: any) {
    const res = err.response?.data
    showSnack(res?.message || res?.error || t('error'), 'error')
  } finally {
    testingKey.value = false
  }
}

async function saveGeneral() {
  savingGeneral.value = true
  try {
    await api.put(`/tenants/${tenantId.value}/settings/general`, {
      company_name: generalSettings.companyName,
      timezone: generalSettings.timezone,
      language: generalSettings.language,
      exchange_rate_vnd: generalSettings.exchangeRate,
      app_url: generalSettings.appUrl,
    })
    showSnack(t('success'), 'success')
  } catch (err: any) {
    showSnack(err.response?.data?.error || t('error'), 'error')
  } finally {
    savingGeneral.value = false
  }
}

function showSnack(text: string, color: string) {
  snackText.value = text
  snackColor.value = color
  snackbar.value = true
}

onMounted(async () => {
  await loadSettings()
  // Nạp sau khi đã biết nhà cung cấp và model đang chọn
  loadModelList()
})
</script>
