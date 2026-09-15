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
          <div v-if="!useCustomBaseUrl" class="text-caption text-grey mb-2">Bật khi cần dùng proxy (OpenRouter, LiteLLM, CLIProxy) hoặc máy chủ tự dựng</div>
          <div v-else class="text-caption text-grey mb-2">Điền xong hãy lưu cài đặt rồi bấm nút làm mới cạnh ô Model AI, danh sách model sẽ lấy theo đúng proxy này</div>

          <v-text-field
            v-if="useCustomBaseUrl"
            v-model="aiSettings.baseUrl"
            label="Base URL"
            :placeholder="baseUrlPlaceholder"
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

        <!-- Storage -->
        <v-card v-if="activeTab === 'storage'" class="pa-6">
          <div class="text-subtitle-1 font-weight-bold mb-1">
            <v-icon start size="small">mdi-folder-multiple-image</v-icon>
            {{ $t('storage_settings') }}
          </div>
          <div class="text-body-2 text-grey mb-5">{{ $t('storage_intro') }}</div>

          <v-alert
            :type="storage.backend === 's3' ? 'success' : 'info'"
            variant="tonal"
            density="comfortable"
            class="mb-5"
          >
            <span v-if="storage.backend === 's3'">
              {{ $t('storage_now_s3') }} <strong>{{ storage.bucket }}</strong> · {{ storageHost }}
            </span>
            <span v-else>{{ $t('storage_now_local') }}</span>
          </v-alert>

          <v-switch
            v-model="dungS3"
            color="primary"
            density="compact"
            hide-details
            class="mb-2"
            :label="$t('storage_use_s3')"
            @update:model-value="testResult = null"
          />

          <v-expand-transition>
            <div v-if="dungS3">
              <v-divider class="my-4" />

              <v-text-field
                v-model="storage.endpoint"
                :label="$t('storage_endpoint')"
                placeholder="https://s3.nha-cung-cap.vn"
                density="comfortable"
                class="mb-3"
                hide-details="auto"
                @update:model-value="testResult = null"
              />

              <v-row dense>
                <v-col cols="12" sm="7">
                  <v-text-field
                    v-model="storage.bucket"
                    :label="$t('storage_bucket')"
                    density="comfortable"
                    hide-details="auto"
                    @update:model-value="testResult = null"
                  />
                </v-col>
                <v-col cols="12" sm="5">
                  <v-text-field
                    v-model="storage.region"
                    :label="$t('storage_region')"
                    density="comfortable"
                    hide-details="auto"
                    @update:model-value="testResult = null"
                  />
                </v-col>
              </v-row>

              <v-text-field
                v-model="storage.access_key"
                label="Access Key"
                density="comfortable"
                class="mt-3"
                hide-details="auto"
                @update:model-value="testResult = null"
              />

              <v-text-field
                v-model="storage.secret_key"
                label="Secret Key"
                type="password"
                density="comfortable"
                class="mt-3"
                hide-details="auto"
                :placeholder="storage.secret_key_da_luu ? '••••••••' : ''"
                :hint="storage.secret_key_da_luu ? $t('storage_secret_saved') : ''"
                persistent-hint
                @update:model-value="testResult = null"
              />

              <v-expansion-panels variant="accordion" class="mt-4">
                <v-expansion-panel elevation="0">
                  <v-expansion-panel-title class="text-body-2">{{ $t('advanced_options') }}</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-text-field
                      v-model="storage.prefix"
                      :label="$t('storage_prefix')"
                      density="comfortable"
                      hide-details="auto"
                      @update:model-value="testResult = null"
                    />
                    <v-switch
                      v-model="storage.force_path_style"
                      color="primary"
                      density="compact"
                      hide-details
                      class="mt-2"
                      :label="$t('storage_path_style')"
                      @update:model-value="testResult = null"
                    />
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>

              <v-alert
                v-if="testResult"
                :type="testResult.ok ? 'success' : 'error'"
                variant="tonal"
                density="comfortable"
                class="mt-4"
              >
                {{ testResult.message }}
              </v-alert>

              <div class="d-flex flex-wrap align-center ga-3 mt-5">
                <v-btn variant="outlined" :loading="testingStorage" prepend-icon="mdi-lan-connect" @click="testStorage">
                  {{ $t('storage_test') }}
                </v-btn>
                <v-btn color="primary" :disabled="!testResult?.ok" :loading="savingStorage" @click="saveStorage">
                  {{ $t('save_settings') }}
                </v-btn>
                <span v-if="!testResult?.ok" class="text-caption text-grey">{{ $t('storage_must_test') }}</span>
              </div>

              <v-divider class="my-6" />
              <div class="text-body-2 font-weight-medium mb-1">{{ $t('storage_old_files_title') }}</div>
              <div class="text-body-2 text-grey mb-3">{{ $t('storage_old_files_desc') }}</div>
              <v-btn
                variant="text"
                color="primary"
                size="small"
                prepend-icon="mdi-book-open-variant"
                href="https://tanviet12.github.io/chat-quality-agent/guide/s3-storage.html"
                target="_blank"
              >
                {{ $t('storage_guide') }}
              </v-btn>
            </div>
          </v-expand-transition>

          <div v-if="!dungS3 && storage.backend === 's3'" class="mt-4">
            <v-btn color="primary" :loading="savingStorage" @click="saveStorage">{{ $t('save_settings') }}</v-btn>
          </div>
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
const savingStorage = ref(false)
const testingStorage = ref(false)

// Nơi cất file đính kèm, cấu hình riêng cho từng công ty.
const storage = reactive({
  backend: 'local',
  endpoint: '',
  bucket: '',
  region: '',
  access_key: '',
  secret_key: '',
  prefix: '',
  force_path_style: false,
  secret_key_da_luu: false,
})
const dungS3 = ref(false)
const testResult = ref<{ ok: boolean; message: string } | null>(null)
const storageHost = computed(() => storage.endpoint.replace(/^https?:\/\//, '').replace(/\/$/, ''))

const tabs = [
  { label: 'ai_config', value: 'ai', icon: 'mdi-robot' },
  { label: 'analysis_settings', value: 'analysis', icon: 'mdi-chart-bar' },
  { label: 'storage_settings', value: 'storage', icon: 'mdi-folder-multiple-image' },
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

const baseUrlPlaceholder = computed(() => {
  switch (aiSettings.provider) {
    case 'gemini': return 'https://generativelanguage.googleapis.com'
    case 'openai': return 'https://api.openai.com/v1'
    case 'xai': return 'https://api.x.ai/v1'
    default: return 'https://api.anthropic.com'
  }
})

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

async function loadStorage() {
  try {
    const { data } = await api.get(`/tenants/${tenantId.value}/settings/storage`)
    Object.assign(storage, data, { secret_key: '' })
    dungS3.value = data.backend === 's3'
    testResult.value = null
  } catch { /* giữ mặc định lưu trên máy chủ */ }
}

function storagePayload() {
  return {
    backend: dungS3.value ? 's3' : 'local',
    endpoint: storage.endpoint,
    bucket: storage.bucket,
    region: storage.region,
    access_key: storage.access_key,
    secret_key: storage.secret_key,
    prefix: storage.prefix,
    force_path_style: storage.force_path_style,
  }
}

async function testStorage() {
  testingStorage.value = true
  testResult.value = null
  try {
    const { data } = await api.post(`/tenants/${tenantId.value}/settings/storage/test`, storagePayload())
    testResult.value = { ok: data.ok === true, message: data.message || '' }
  } catch (e: any) {
    testResult.value = { ok: false, message: e.response?.data?.message || t('connection_failed') }
  } finally {
    testingStorage.value = false
  }
}

async function saveStorage() {
  savingStorage.value = true
  try {
    await api.put(`/tenants/${tenantId.value}/settings/storage`, storagePayload())
    await loadStorage()
    showSnack(t('settings_saved'), 'success')
  } catch (e: any) {
    showSnack(e.response?.data?.message || t('save_failed'), 'error')
  } finally {
    savingStorage.value = false
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
  loadStorage()
})
</script>
