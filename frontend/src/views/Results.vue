<!--
  Trang Kết quả — gom kết quả của mọi tác vụ trong công ty.
  Lọc và phân trang chạy dưới database (GET /results), không tải hết về máy khách.
-->
<template>
  <div>
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-4">
      <h1 class="text-h5 font-weight-bold">{{ $t('nav_results') }}</h1>
      <div v-if="!trangRong" class="d-flex ga-2">
        <v-btn variant="outlined" size="small" prepend-icon="mdi-file-delimited" :loading="dangXuat === 'csv'" @click="xuatFile('csv')">CSV</v-btn>
        <v-btn variant="outlined" size="small" prepend-icon="mdi-file-excel" :loading="dangXuat === 'xlsx'" @click="xuatFile('xlsx')">Excel</v-btn>
      </div>
    </div>

    <v-skeleton-loader v-if="dangTaiFacets" type="article, table" />

    <!-- Công ty chưa có tác vụ nào -->
    <v-card v-else-if="trangRong" class="pa-10 text-center">
      <v-icon size="48" color="grey-lighten-1">mdi-clipboard-text-search-outline</v-icon>
      <div class="text-subtitle-1 font-weight-bold mt-3">{{ $t('results_empty_title') }}</div>
      <div class="text-body-2 text-grey mt-1 mb-4">{{ $t('results_empty_desc') }}</div>
      <v-btn color="primary" prepend-icon="mdi-robot" :to="`/${tenantId}/jobs`">{{ $t('nav_jobs') }}</v-btn>
    </v-card>

    <template v-else>
      <!-- Tab chỉ hiện khi công ty có cả hai loại tác vụ -->
      <v-tabs v-if="hienTab" v-model="jobType" density="compact" class="mb-3">
        <v-tab value="qc_analysis">
          <v-icon start size="small">mdi-star-check</v-icon>
          {{ $t('results_tab_qc') }}
        </v-tab>
        <v-tab value="classification">
          <v-icon start size="small">mdi-tag-multiple</v-icon>
          {{ $t('results_tab_classification') }}
        </v-tab>
      </v-tabs>

      <!-- Thanh lọc trên mobile: ô tìm + một nút mở bảng lọc -->
      <div v-if="!mdAndUp" class="d-flex align-center ga-2 mb-3">
        <v-text-field
          v-model="tuKhoa"
          :placeholder="$t('results_search')"
          density="compact"
          variant="outlined"
          prepend-inner-icon="mdi-magnify"
          hide-details
          clearable
          class="flex-grow-1"
        />
        <v-btn variant="outlined" height="40" class="loc-nut" @click="moLocMobile = true">
          <v-icon size="small">mdi-filter-variant</v-icon>
          <v-chip v-if="soLoc" size="x-small" color="primary" variant="flat" class="ml-1">{{ soLoc }}</v-chip>
        </v-btn>
      </div>

      <!-- Thanh lọc trên desktop: mỗi bộ lọc là một nút nhỏ mở menu riêng -->
      <div v-else class="d-flex align-center flex-wrap ga-2 mb-3">
        <v-text-field
          v-model="tuKhoa"
          :placeholder="$t('results_search')"
          density="compact"
          variant="outlined"
          prepend-inner-icon="mdi-magnify"
          hide-details
          clearable
          class="loc-tim"
        />

        <v-menu :close-on-content-click="false">
          <template #activator="{ props }">
            <v-btn v-bind="props" variant="outlined" size="small" class="loc-nut">
              {{ $t('results_filter_job') }}
              <v-chip v-if="jobIDs.length" size="x-small" color="primary" variant="flat" class="ml-2">{{ jobIDs.length }}</v-chip>
              <v-icon end size="small">mdi-menu-down</v-icon>
            </v-btn>
          </template>
          <v-card min-width="260" max-height="360" class="overflow-y-auto">
            <v-list density="compact">
              <v-list-item v-for="j in dsTacVu" :key="j.id" @click="doiChon(jobIDs, j.id)">
                <template #prepend>
                  <v-checkbox-btn :model-value="jobIDs.includes(j.id)" density="compact" />
                </template>
                <v-list-item-title class="text-body-2">{{ j.name }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card>
        </v-menu>

        <v-menu :close-on-content-click="false">
          <template #activator="{ props }">
            <v-btn v-bind="props" variant="outlined" size="small" class="loc-nut">
              {{ $t('results_filter_channel') }}
              <v-chip v-if="channelIDs.length" size="x-small" color="primary" variant="flat" class="ml-2">{{ channelIDs.length }}</v-chip>
              <v-icon end size="small">mdi-menu-down</v-icon>
            </v-btn>
          </template>
          <v-card min-width="240" max-height="360" class="overflow-y-auto">
            <v-list density="compact">
              <v-list-item v-for="k in facets.channels" :key="k.id" @click="doiChon(channelIDs, k.id)">
                <template #prepend>
                  <v-checkbox-btn :model-value="channelIDs.includes(k.id)" density="compact" />
                </template>
                <v-list-item-title class="text-body-2">{{ k.name }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card>
        </v-menu>

        <!-- Phân loại: lọc theo nhãn. Chất lượng CSKH: lọc theo điểm -->
        <v-menu v-if="laPhanLoai" :close-on-content-click="false">
          <template #activator="{ props }">
            <v-btn v-bind="props" variant="outlined" size="small" class="loc-nut">
              {{ $t('results_filter_tag') }}
              <v-chip v-if="tags.length" size="x-small" color="primary" variant="flat" class="ml-2">{{ tags.length }}</v-chip>
              <v-icon end size="small">mdi-menu-down</v-icon>
            </v-btn>
          </template>
          <v-card min-width="220" max-height="360" class="overflow-y-auto">
            <v-list density="compact">
              <v-list-item v-for="n in facets.tags" :key="n" @click="doiChon(tags, n)">
                <template #prepend>
                  <v-checkbox-btn :model-value="tags.includes(n)" density="compact" />
                </template>
                <v-list-item-title class="text-body-2">{{ n }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card>
        </v-menu>

        <v-menu v-else :close-on-content-click="false">
          <template #activator="{ props }">
            <v-btn v-bind="props" variant="outlined" size="small" class="loc-nut">
              {{ locDiem ? `${$t('results_filter_score')} ${khoangDiem[0]}–${khoangDiem[1]}` : $t('results_filter_score') }}
              <v-icon end size="small">mdi-menu-down</v-icon>
            </v-btn>
          </template>
          <v-card min-width="300" class="pa-4">
            <div class="text-body-2 font-weight-medium mb-3">
              {{ $t('results_score_range', { min: khoangDiem[0], max: khoangDiem[1] }) }}
            </div>
            <v-range-slider v-model="khoangDiem" :min="0" :max="100" :step="5" density="compact" thumb-label hide-details />
            <div class="d-flex justify-end mt-3">
              <v-btn size="small" variant="text" @click="khoangDiem = [0, 100]">{{ $t('reset') }}</v-btn>
            </div>
          </v-card>
        </v-menu>

        <v-menu :close-on-content-click="false">
          <template #activator="{ props }">
            <v-btn v-bind="props" variant="outlined" size="small" class="loc-nut">
              <v-icon start size="small">mdi-calendar</v-icon>
              {{ nhanThoiGian }}
              <v-icon end size="small">mdi-menu-down</v-icon>
            </v-btn>
          </template>
          <v-card min-width="330" class="pa-4">
            <v-btn-toggle v-model="dateField" density="compact" variant="outlined" divided mandatory class="mb-3 w-100">
              <v-btn value="conv" size="small" class="flex-grow-1">{{ $t('results_date_conv') }}</v-btn>
              <v-btn value="eval" size="small" class="flex-grow-1">{{ $t('results_date_eval') }}</v-btn>
            </v-btn-toggle>
            <div class="d-flex flex-wrap ga-1 mb-3">
              <v-chip
                v-for="p in presets"
                :key="p.value"
                size="small"
                :variant="preset === p.value ? 'flat' : 'outlined'"
                :color="preset === p.value ? 'primary' : ''"
                @click="apDungPreset(p.value)"
              >{{ $t(p.label) }}</v-chip>
            </div>
            <div class="d-flex ga-2">
              <v-text-field v-model="tuNgay" type="date" density="compact" variant="outlined" :label="$t('from_date')" hide-details @update:model-value="preset = 'custom'" />
              <v-text-field v-model="denNgay" type="date" density="compact" variant="outlined" :label="$t('to_date')" hide-details @update:model-value="preset = 'custom'" />
            </div>
          </v-card>
        </v-menu>

        <v-menu>
          <template #activator="{ props }">
            <v-btn v-bind="props" variant="outlined" size="small" class="loc-nut">
              <v-icon start size="small">mdi-sort</v-icon>
              {{ $t(nhanSapXep) }}
              <v-icon end size="small">mdi-menu-down</v-icon>
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item v-for="s in dsSapXep" :key="s.value" @click="sort = s.value">
              <v-list-item-title class="text-body-2">{{ $t(s.label) }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>

        <v-btn v-if="coLoc" size="small" variant="text" color="grey-darken-1" @click="xoaLoc">
          {{ $t('results_clear_filter') }}
        </v-btn>
      </div>

      <!-- Chip đếm + chuyển chế độ xem -->
      <div class="d-flex align-center justify-space-between ga-2 mb-3">
        <div class="d-flex ga-2 hang-chip">
          <template v-if="!laPhanLoai">
            <v-chip size="small" :variant="verdict === 'all' ? 'flat' : 'outlined'" :color="verdict === 'all' ? 'primary' : ''" @click="datVerdict('all')">
              {{ $t('filter_all') }}: {{ counts.all }}
            </v-chip>
            <v-chip size="small" :variant="verdict === 'fail' ? 'flat' : 'outlined'" :color="verdict === 'fail' ? 'error' : ''" @click="datVerdict('fail')">
              {{ $t('filter_failed') }}: {{ counts.fail }}
            </v-chip>
            <v-chip size="small" :variant="verdict === 'pass' ? 'flat' : 'outlined'" :color="verdict === 'pass' ? 'success' : ''" @click="datVerdict('pass')">
              {{ $t('filter_passed') }}: {{ counts.pass }}
            </v-chip>
            <v-chip size="small" :variant="verdict === 'skip' ? 'flat' : 'outlined'" :color="verdict === 'skip' ? 'grey' : ''" @click="datVerdict('skip')">
              {{ $t('verdict_skip') }}: {{ counts.skip }}
            </v-chip>
          </template>
          <template v-else>
            <v-chip size="small" :variant="verdict === 'classified' ? 'flat' : 'outlined'" :color="verdict === 'classified' ? 'secondary' : ''" @click="datVerdict('classified')">
              {{ $t('results_classified') }}: {{ counts.classified }}
            </v-chip>
            <v-chip size="small" :variant="verdict === 'all' ? 'flat' : 'outlined'" :color="verdict === 'all' ? 'primary' : ''" @click="datVerdict('all')">
              {{ $t('filter_all') }}: {{ counts.all }}
            </v-chip>
            <v-chip size="small" :variant="verdict === 'skip' ? 'flat' : 'outlined'" :color="verdict === 'skip' ? 'grey' : ''" @click="datVerdict('skip')">
              {{ $t('verdict_skip') }}: {{ counts.skip }}
            </v-chip>
          </template>
        </div>
        <v-btn-toggle v-if="mdAndUp" v-model="cheDoXem" density="compact" variant="outlined" divided mandatory>
          <v-btn value="card" size="small"><v-icon size="small">mdi-format-list-bulleted</v-icon></v-btn>
          <v-btn value="table" size="small"><v-icon size="small">mdi-table</v-icon></v-btn>
        </v-btn-toggle>
      </div>

      <v-skeleton-loader v-if="dangTai" type="table-row@5" />

      <!-- Có tác vụ nhưng chưa chạy lần nào -->
      <v-card v-else-if="!items.length && !coLoc && !counts.all" class="pa-10 text-center">
        <v-icon size="48" color="grey-lighten-1">mdi-play-circle-outline</v-icon>
        <div class="text-subtitle-1 font-weight-bold mt-3">{{ $t('results_no_run_title') }}</div>
        <div class="text-body-2 text-grey mt-1 mb-4">{{ $t('results_no_run_desc') }}</div>
        <v-btn color="primary" prepend-icon="mdi-play" :to="`/${tenantId}/jobs`">{{ $t('nav_jobs') }}</v-btn>
      </v-card>

      <v-card v-else-if="!items.length" class="pa-10 text-center text-grey">
        {{ $t('results_no_match') }}
      </v-card>

      <!-- Bảng: cột quan trọng đứng trước -->
      <v-card v-else-if="xemBang">
        <v-table density="compact" hover>
          <thead>
            <tr>
              <th style="min-width: 130px">{{ $t('results_col_customer') }}</th>
              <template v-if="!laPhanLoai">
                <th style="width: 110px">{{ $t('results_col_verdict') }}</th>
                <th style="width: 70px" class="text-right">{{ $t('results_col_score') }}</th>
                <th style="width: 34%">{{ $t('results_col_issues') }}</th>
              </template>
              <th v-else style="width: 34%">{{ $t('results_col_tags') }}</th>
              <th style="width: 105px">{{ $t('results_col_date') }}</th>
              <th style="width: 170px" class="d-none d-lg-table-cell">{{ $t('results_col_job') }}</th>
              <th style="width: 135px" class="d-none d-lg-table-cell">{{ $t('results_col_channel') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in items" :key="r.id" style="cursor: pointer" @click="moChiTiet(r)">
              <td class="font-weight-medium">{{ r.customer_name || '—' }}</td>
              <template v-if="!laPhanLoai">
                <td>
                  <v-chip size="x-small" :color="mauKetQua(r.severity)" variant="tonal">{{ nhanKetQua(r.severity) }}</v-chip>
                </td>
                <td class="text-right">{{ r.severity === 'SKIP' || r.score === null ? '—' : r.score }}</td>
                <td class="text-body-2"><div class="cat-dong">{{ tomTatVanDe(r) }}</div></td>
              </template>
              <td v-else class="text-body-2"><div class="cat-dong">{{ r.tags.length ? r.tags.join('; ') : '—' }}</div></td>
              <td class="text-body-2 text-grey-darken-1" style="white-space: nowrap">{{ hienNgayGio(r.conversation_at) }}</td>
              <td class="text-body-2 text-grey-darken-1 d-none d-lg-table-cell">{{ r.job_name }}</td>
              <td class="text-body-2 text-grey-darken-1 d-none d-lg-table-cell">{{ r.channel_name }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <!-- Thẻ -->
      <div v-else>
        <v-card v-for="r in items" :key="r.id" class="mb-3 pa-4" style="cursor: pointer" @click="moChiTiet(r)">
          <div class="d-flex align-center ga-2">
            <span class="font-weight-medium text-truncate">{{ r.customer_name || '—' }}</span>
            <v-spacer />
            <v-icon size="small" color="grey">mdi-chevron-right</v-icon>
          </div>
          <div class="d-flex align-center flex-wrap ga-2 mt-2 mb-2">
            <v-chip v-if="!laPhanLoai" size="x-small" :color="mauKetQua(r.severity)" variant="tonal">{{ nhanKetQua(r.severity) }}</v-chip>
            <v-chip v-if="!laPhanLoai && r.severity !== 'SKIP' && r.score !== null" size="x-small" variant="tonal">{{ r.score }}/100</v-chip>
            <span class="text-caption text-grey">{{ hienNgayGio(r.conversation_at) }}</span>
          </div>
          <div class="text-body-2 text-grey-darken-2 mb-2 cat-dong-3">
            {{ laPhanLoai ? (r.tags.length ? r.tags.join('; ') : '—') : tomTatVanDe(r) }}
          </div>
          <div class="text-caption text-grey">{{ r.job_name }} · {{ r.channel_name }}</div>
        </v-card>
      </div>

      <div v-if="tongTrang > 1" class="d-flex justify-center mt-4">
        <v-pagination v-model="page" :length="tongTrang" density="compact" :total-visible="mdAndUp ? 7 : 3" />
      </div>
    </template>

    <!-- Bảng lọc trên mobile -->
    <v-bottom-sheet v-model="moLocMobile">
      <v-card>
        <v-card-title class="d-flex align-center text-subtitle-1">
          {{ $t('results_filters') }}
          <v-spacer />
          <v-btn icon variant="text" size="small" @click="moLocMobile = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-card-text class="pt-4" style="max-height: 70vh; overflow-y: auto">
          <v-select
            v-model="jobIDs"
            :items="dsTacVu"
            item-title="name"
            item-value="id"
            :label="$t('results_filter_job')"
            density="compact"
            variant="outlined"
            multiple
            chips
            class="mb-3"
            hide-details
          />
          <v-select
            v-model="channelIDs"
            :items="facets.channels"
            item-title="name"
            item-value="id"
            :label="$t('results_filter_channel')"
            density="compact"
            variant="outlined"
            multiple
            chips
            class="mb-3"
            hide-details
          />
          <v-select
            v-if="laPhanLoai"
            v-model="tags"
            :items="facets.tags"
            :label="$t('results_filter_tag')"
            density="compact"
            variant="outlined"
            multiple
            chips
            class="mb-3"
            hide-details
          />
          <template v-else>
            <div class="text-body-2 mb-1">{{ $t('results_score_range', { min: khoangDiem[0], max: khoangDiem[1] }) }}</div>
            <v-range-slider v-model="khoangDiem" :min="0" :max="100" :step="5" density="compact" thumb-label hide-details class="mb-3 px-1" />
          </template>

          <div class="text-body-2 mb-1">{{ $t('results_time') }}</div>
          <v-btn-toggle v-model="dateField" density="compact" variant="outlined" divided mandatory class="mb-3 w-100">
            <v-btn value="conv" size="small" class="flex-grow-1">{{ $t('results_date_conv') }}</v-btn>
            <v-btn value="eval" size="small" class="flex-grow-1">{{ $t('results_date_eval') }}</v-btn>
          </v-btn-toggle>
          <div class="d-flex flex-wrap ga-1 mb-3">
            <v-chip
              v-for="p in presets"
              :key="p.value"
              size="small"
              :variant="preset === p.value ? 'flat' : 'outlined'"
              :color="preset === p.value ? 'primary' : ''"
              @click="apDungPreset(p.value)"
            >{{ $t(p.label) }}</v-chip>
          </div>
          <div class="d-flex ga-2 mb-3">
            <v-text-field v-model="tuNgay" type="date" density="compact" variant="outlined" :label="$t('from_date')" hide-details @update:model-value="preset = 'custom'" />
            <v-text-field v-model="denNgay" type="date" density="compact" variant="outlined" :label="$t('to_date')" hide-details @update:model-value="preset = 'custom'" />
          </div>

          <v-select
            v-model="sort"
            :items="dsSapXepMobile"
            item-title="title"
            item-value="value"
            :label="$t('results_sort')"
            density="compact"
            variant="outlined"
            hide-details
          />
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-btn variant="text" @click="xoaLoc">{{ $t('results_clear_filter') }}</v-btn>
          <v-spacer />
          <v-btn color="primary" variant="flat" @click="moLocMobile = false">{{ $t('results_apply') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-bottom-sheet>

    <!-- Chi tiết một hội thoại -->
    <v-dialog v-model="moChiTietDialog" max-width="720" scrollable>
      <v-card v-if="chiTiet">
        <v-card-title class="d-flex align-center flex-wrap ga-2 text-subtitle-1">
          <v-chip v-if="!laPhanLoai" size="small" :color="mauKetQua(chiTiet.severity)" variant="tonal">{{ nhanKetQua(chiTiet.severity) }}</v-chip>
          <span class="font-weight-bold">{{ chiTiet.customer_name || '—' }}</span>
          <v-chip v-if="!laPhanLoai && chiTiet.severity !== 'SKIP' && chiTiet.score !== null" size="small" variant="tonal">{{ chiTiet.score }}/100</v-chip>
          <v-spacer />
          <v-btn icon variant="text" size="small" @click="moChiTietDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-card-text>
          <div class="text-caption text-grey mb-3">
            {{ chiTiet.job_name }} · {{ chiTiet.channel_name }} ·
            {{ $t('results_col_date') }}: {{ hienNgayGio(chiTiet.conversation_at) }} ·
            {{ $t('results_date_eval') }}: {{ hienNgayGio(chiTiet.evaluated_at) }}
          </div>

          <v-alert v-if="chiTiet.review" :type="chiTiet.severity === 'PASS' ? 'success' : 'warning'" variant="tonal" density="compact" class="mb-3 text-body-2">
            {{ chiTiet.review }}
          </v-alert>

          <div v-if="laPhanLoai && chiTiet.tags.length" class="mb-3 d-flex flex-wrap ga-2">
            <v-chip v-for="t in chiTiet.tags" :key="t" size="small" color="secondary" variant="tonal">{{ t }}</v-chip>
          </div>

          <div v-if="chiTiet.issues.length">
            <div class="text-body-2 font-weight-medium mb-2">{{ $t('results_col_issues') }}</div>
            <v-card v-for="(i, idx) in chiTiet.issues" :key="idx" variant="tonal" class="pa-3 mb-2">
              <div class="text-body-2 font-weight-medium">{{ i.rule_name }}</div>
              <div v-if="i.evidence" class="text-body-2 text-grey-darken-2 mt-1">{{ i.evidence }}</div>
            </v-card>
          </div>
          <div v-else-if="!laPhanLoai" class="text-body-2 text-grey">{{ $t('no_issues') }}</div>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-btn variant="text" :to="`/${tenantId}/jobs/${chiTiet.job_id}`">{{ $t('results_open_job') }}</v-btn>
          <v-spacer />
          <v-btn variant="flat" color="primary" @click="moChiTietDialog = false">{{ $t('close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="baoLoi" color="error" timeout="6000">{{ noiDungLoi }}</v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useI18n } from 'vue-i18n'
import api from '../api'

interface IssueItem {
  rule_name: string
  evidence: string
  severity: string
}

interface ResultItem {
  id: string
  conversation_id: string
  job_id: string
  job_name: string
  channel_id: string
  channel_name: string
  customer_name: string
  conversation_at: string | null
  evaluated_at: string
  severity: string
  review: string
  score: number | null
  issues: IssueItem[]
  tags: string[]
}

interface JobFacet { id: string; name: string; job_type: string }
interface ChannelFacet { id: string; name: string }

const route = useRoute()
const { t } = useI18n()
const { mdAndUp } = useDisplay()

const tenantId = computed(() => route.params.tenantId as string)

const dangTaiFacets = ref(true)
const dangTai = ref(false)
const dangXuat = ref('')
const baoLoi = ref(false)
const noiDungLoi = ref('')

const facets = ref<{
  types: Record<string, { jobs: number; results: number }>
  jobs: JobFacet[]
  channels: ChannelFacet[]
  tags: string[]
}>({ types: {}, jobs: [], channels: [], tags: [] })

const jobType = ref<'qc_analysis' | 'classification'>('qc_analysis')
const verdict = ref('all')
const tuKhoa = ref('')
const jobIDs = ref<string[]>([])
const channelIDs = ref<string[]>([])
const tags = ref<string[]>([])
const khoangDiem = ref<[number, number]>([0, 100])
const dateField = ref<'conv' | 'eval'>('conv')
const preset = ref('all')
const tuNgay = ref('')
const denNgay = ref('')
const sort = ref('recent')
const page = ref(1)
const pageSize = 25
const cheDoXem = ref<'card' | 'table'>('table')
const moLocMobile = ref(false)

const items = ref<ResultItem[]>([])
const total = ref(0)
const counts = ref({ all: 0, pass: 0, fail: 0, skip: 0, classified: 0 })

const chiTiet = ref<ResultItem | null>(null)
const moChiTietDialog = ref(false)

const presets = [
  { label: 'results_preset_all', value: 'all' },
  { label: 'today', value: 'today' },
  { label: 'results_preset_7days', value: '7days' },
  { label: 'results_preset_28days', value: '28days' },
  { label: 'results_preset_month', value: 'month' },
]
const dsSapXep = [
  { label: 'results_sort_recent', value: 'recent' },
  { label: 'results_sort_score_asc', value: 'score_asc' },
  { label: 'results_sort_score_desc', value: 'score_desc' },
]
const dsSapXepMobile = computed(() => dsSapXep.map(s => ({ title: t(s.label), value: s.value })))

const laPhanLoai = computed(() => jobType.value === 'classification')
const coQC = computed(() => (facets.value.types.qc_analysis?.jobs || 0) > 0)
const coPhanLoai = computed(() => (facets.value.types.classification?.jobs || 0) > 0)
const hienTab = computed(() => coQC.value && coPhanLoai.value)
const trangRong = computed(() => !dangTaiFacets.value && !coQC.value && !coPhanLoai.value)
const xemBang = computed(() => mdAndUp.value && cheDoXem.value === 'table')
const tongTrang = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

const locDiem = computed(() => khoangDiem.value[0] !== 0 || khoangDiem.value[1] !== 100)
const soLoc = computed(
  () => jobIDs.value.length + channelIDs.value.length + tags.value.length + (locDiem.value ? 1 : 0) + (preset.value !== 'all' ? 1 : 0)
)
const coLoc = computed(() => !!tuKhoa.value || soLoc.value > 0 || verdict.value !== 'all')

// Chỉ liệt kê tác vụ đúng loại tab đang mở
const dsTacVu = computed(() => facets.value.jobs.filter(j => j.job_type === jobType.value))

const nhanSapXep = computed(() => dsSapXep.find(s => s.value === sort.value)?.label || 'results_sort_recent')
const nhanThoiGian = computed(() => {
  const moc = dateField.value === 'conv' ? t('results_date_conv_short') : t('results_date_eval_short')
  const p = presets.find(x => x.value === preset.value)
  if (p) return `${t(p.label)} · ${moc}`
  return `${hienNgay(tuNgay.value)} – ${hienNgay(denNgay.value)} · ${moc}`
})

function hienNgay(s: string) {
  if (!s) return '—'
  const [, m, d] = s.split('-')
  return `${d}/${m}`
}

function hienNgayGio(s: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  const hai = (n: number) => String(n).padStart(2, '0')
  return `${hai(d.getDate())}/${hai(d.getMonth() + 1)} ${hai(d.getHours())}:${hai(d.getMinutes())}`
}

// Template đã tự bóc ref nên nhận thẳng mảng; sửa tại chỗ vẫn giữ tính phản ứng.
function doiChon(arr: string[], v: string) {
  const i = arr.indexOf(v)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(v)
}

function dinhDang(d: Date) {
  const hai = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}`
}

function apDungPreset(v: string) {
  preset.value = v
  if (v === 'all') {
    tuNgay.value = ''
    denNgay.value = ''
    return
  }
  const d = new Date()
  const y = d.getFullYear()
  const m = d.getMonth()
  denNgay.value = dinhDang(d)
  if (v === 'today') tuNgay.value = dinhDang(d)
  else if (v === '7days') tuNgay.value = dinhDang(new Date(y, m, d.getDate() - 7))
  else if (v === '28days') tuNgay.value = dinhDang(new Date(y, m, d.getDate() - 28))
  else if (v === 'month') tuNgay.value = dinhDang(new Date(y, m, 1))
}

function xoaLoc() {
  tuKhoa.value = ''
  jobIDs.value = []
  channelIDs.value = []
  tags.value = []
  khoangDiem.value = [0, 100]
  verdict.value = 'all'
  apDungPreset('all')
}

function datVerdict(v: string) {
  verdict.value = verdict.value === v ? 'all' : v
}

function mauKetQua(severity: string) {
  if (severity === 'PASS') return 'success'
  if (severity === 'SKIP') return 'grey'
  return 'error'
}

function nhanKetQua(severity: string) {
  if (severity === 'PASS') return t('verdict_pass')
  if (severity === 'SKIP') return t('verdict_skip')
  return t('verdict_fail')
}

function tomTatVanDe(r: ResultItem) {
  if (!r.issues.length) return r.severity === 'SKIP' ? r.review || '—' : '—'
  return r.issues.map(i => (i.evidence ? `${i.rule_name}: ${i.evidence}` : i.rule_name)).join('; ')
}

function moChiTiet(r: ResultItem) {
  chiTiet.value = r
  moChiTietDialog.value = true
}

function thamSo() {
  const p: Record<string, string> = {
    job_type: jobType.value,
    verdict: verdict.value,
    date_field: dateField.value,
    sort: sort.value,
  }
  if (tuKhoa.value) p.q = tuKhoa.value
  if (jobIDs.value.length) p.job_ids = jobIDs.value.join(',')
  if (channelIDs.value.length) p.channel_ids = channelIDs.value.join(',')
  if (tags.value.length) p.tags = tags.value.join(',')
  if (tuNgay.value) p.from = tuNgay.value
  if (denNgay.value) p.to = denNgay.value
  if (locDiem.value) {
    p.score_min = String(khoangDiem.value[0])
    p.score_max = String(khoangDiem.value[1])
  }
  return p
}

async function taiFacets() {
  dangTaiFacets.value = true
  try {
    const { data } = await api.get(`/tenants/${tenantId.value}/results/facets`)
    facets.value = data
    // Công ty chỉ chạy một loại tác vụ thì vào thẳng loại đó, không có tab rỗng
    if (!coQC.value && coPhanLoai.value) jobType.value = 'classification'
    else jobType.value = 'qc_analysis'
  } catch {
    hienLoi(t('results_load_error'))
  } finally {
    dangTaiFacets.value = false
  }
}

async function taiKetQua() {
  if (trangRong.value) return
  dangTai.value = true
  try {
    const { data } = await api.get(`/tenants/${tenantId.value}/results`, {
      params: { ...thamSo(), page: page.value, page_size: pageSize },
    })
    items.value = data.items || []
    total.value = data.total || 0
    counts.value = data.counts || { all: 0, pass: 0, fail: 0, skip: 0, classified: 0 }
  } catch {
    hienLoi(t('results_load_error'))
  } finally {
    dangTai.value = false
  }
}

async function xuatFile(format: 'csv' | 'xlsx') {
  dangXuat.value = format
  try {
    const { data } = await api.get(`/tenants/${tenantId.value}/results/export`, {
      params: { ...thamSo(), format },
      responseType: 'blob',
    })
    const loai = format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv;charset=utf-8'
    const url = URL.createObjectURL(new Blob([data], { type: loai }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${laPhanLoai.value ? 'phan-loai' : 'ket-qua'}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e: any) {
    // Lỗi trả về dạng blob khi responseType là blob nên phải đọc lại thành chữ
    let ma = ''
    let gioiHan = 0
    try {
      const text = await e?.response?.data?.text?.()
      const body = text ? JSON.parse(text) : null
      ma = body?.error || ''
      gioiHan = body?.limit || 0
    } catch { /* giữ thông báo chung */ }
    hienLoi(ma === 'export_too_large' ? t('results_export_too_large', { limit: gioiHan }) : t('results_export_error'))
  } finally {
    dangXuat.value = ''
  }
}

function hienLoi(msg: string) {
  noiDungLoi.value = msg
  baoLoi.value = true
}

let henGio: ReturnType<typeof setTimeout> | null = null
function taiLai(doiTrang = true) {
  if (doiTrang) page.value = 1
  if (henGio) clearTimeout(henGio)
  henGio = setTimeout(taiKetQua, 250)
}

watch(jobType, () => {
  // Bộ lọc của hai loại tác vụ không dùng chung được
  jobIDs.value = []
  tags.value = []
  verdict.value = 'all'
  khoangDiem.value = [0, 100]
  taiLai()
})
watch([verdict, dateField, sort, tuNgay, denNgay], () => taiLai())
watch([tuKhoa, jobIDs, channelIDs, tags, khoangDiem], () => taiLai(), { deep: true })
watch(page, () => taiKetQua())

onMounted(async () => {
  await taiFacets()
  await taiKetQua()
})
</script>

<style scoped>
/* Hạ chiều cao ô tìm kiếm cho bằng nút lọc — Vuetify không có prop sẵn cho cỡ này */
.loc-tim {
  max-width: 200px;
}
.loc-tim :deep(.v-field) {
  min-height: 28px;
  font-size: 0.875rem;
}
.loc-tim :deep(.v-field__input) {
  min-height: 28px;
  padding-top: 0;
  padding-bottom: 0;
}
.loc-tim :deep(.v-field__prepend-inner),
.loc-tim :deep(.v-field__clearable) {
  padding-top: 0;
  align-items: center;
}
.loc-tim :deep(.v-field__prepend-inner .v-icon) {
  font-size: 18px;
}
/* Vấn đề thường dài; cắt còn 2 dòng cho bảng dễ quét, bấm vào dòng xem đủ */
.cat-dong {
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cat-dong-3 {
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
/* Hàng nào có vấn đề dài thì cần cao hơn mức mặc định của bảng compact */
:deep(.v-table td) {
  height: auto;
  padding-top: 8px;
  padding-bottom: 8px;
}
.hang-chip {
  overflow-x: auto;
  scrollbar-width: none;
  flex-wrap: nowrap;
  white-space: nowrap;
}
.hang-chip::-webkit-scrollbar {
  display: none;
}
.loc-nut {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}
</style>
