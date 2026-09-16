<!--
  WIREFRAME — Menu mới "Kết quả" (tổng hợp kết quả đánh giá / phân loại của mọi tác vụ)

  Trang tĩnh để duyệt bố cục. Dữ liệu cứng, không gọi API.
  Ô "Kịch bản dữ liệu" ở đầu trang để thử các trường hợp tab động.
-->
<template>
  <v-app>
    <v-main style="background: rgb(250,250,252)">
      <v-container class="py-6" style="max-width: 1280px">
        <!-- Bảng điều khiển của wireframe, KHÔNG có trong bản thật -->
        <v-card class="pa-3 mb-6" color="amber-lighten-5" variant="flat">
          <div class="d-flex align-center flex-wrap ga-3">
            <v-chip size="small" color="warning" variant="tonal">WIREFRAME</v-chip>
            <span class="text-body-2">Kịch bản dữ liệu của công ty:</span>
            <v-btn-toggle v-model="kichBan" density="compact" variant="outlined" divided mandatory>
              <v-btn value="ca-hai" size="small">Có cả hai loại</v-btn>
              <v-btn value="chi-phan-loai" size="small">Chỉ phân loại</v-btn>
              <v-btn value="chi-cskh" size="small">Chỉ CSKH</v-btn>
              <v-btn value="chua-chay" size="small">Có job, chưa chạy</v-btn>
              <v-btn value="trong" size="small">Chưa có gì</v-btn>
            </v-btn-toggle>
          </div>
        </v-card>

        <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-4">
          <h1 class="text-h5 font-weight-bold">Kết quả</h1>
          <div class="d-flex ga-2">
            <v-btn variant="outlined" size="small" prepend-icon="mdi-file-delimited">CSV</v-btn>
            <v-btn variant="outlined" size="small" prepend-icon="mdi-file-excel">Excel</v-btn>
          </div>
        </div>

        <!-- Trạng thái rỗng toàn trang -->
        <v-card v-if="kichBan === 'trong'" class="pa-10 text-center">
          <v-icon size="48" color="grey-lighten-1">mdi-clipboard-text-search-outline</v-icon>
          <div class="text-subtitle-1 font-weight-bold mt-3">Chưa có kết quả nào</div>
          <div class="text-body-2 text-grey mt-1 mb-4">
            Tạo một tác vụ AI và chạy để xem kết quả đánh giá tại đây.
          </div>
          <v-btn color="primary" prepend-icon="mdi-robot">Đi tới Tác vụ AI</v-btn>
        </v-card>

        <template v-else>
          <!-- Tab chỉ hiện khi công ty có cả hai loại tác vụ -->
          <v-tabs v-if="hienTab" v-model="tab" density="compact" class="mb-3">
            <v-tab value="cskh">
              <v-icon start size="small">mdi-star-check</v-icon>
              Chất lượng CSKH
            </v-tab>
            <v-tab value="phan-loai">
              <v-icon start size="small">mdi-tag-multiple</v-icon>
              Phân loại
            </v-tab>
          </v-tabs>

          <!-- THANH LỌC MOBILE: ô tìm full ngang + 1 nút mở bảng lọc -->
          <div v-if="!mdAndUp" class="d-flex align-center ga-2 mb-3">
            <v-text-field
              v-model="tuKhoa"
              placeholder="Tìm tên khách"
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

          <!-- THANH LỌC DESKTOP: một hàng nút gọn, mỗi nút mở menu riêng -->
          <div v-else class="d-flex align-center flex-wrap ga-2 mb-3">
            <v-text-field
              v-model="tuKhoa"
              placeholder="Tìm tên khách"
              density="compact"
              variant="outlined"
              prepend-inner-icon="mdi-magnify"
              hide-details
              clearable
              class="loc-tim"
            />

            <!-- Tác vụ -->
            <v-menu :close-on-content-click="false">
              <template #activator="{ props }">
                <v-btn v-bind="props" variant="outlined" size="small" class="loc-nut">
                  Tác vụ
                  <v-chip v-if="fTacVu.length" size="x-small" color="primary" variant="flat" class="ml-2">
                    {{ fTacVu.length }}
                  </v-chip>
                  <v-icon end size="small">mdi-menu-down</v-icon>
                </v-btn>
              </template>
              <v-card min-width="260">
                <v-list density="compact" select-strategy="leaf">
                  <v-list-item v-for="j in dsTacVu" :key="j" @click="doiChon(fTacVu, j)">
                    <template #prepend>
                      <v-checkbox-btn :model-value="fTacVu.includes(j)" density="compact" />
                    </template>
                    <v-list-item-title class="text-body-2">{{ j }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-card>
            </v-menu>

            <!-- Kênh -->
            <v-menu :close-on-content-click="false">
              <template #activator="{ props }">
                <v-btn v-bind="props" variant="outlined" size="small" class="loc-nut">
                  Kênh
                  <v-chip v-if="fKenh.length" size="x-small" color="primary" variant="flat" class="ml-2">
                    {{ fKenh.length }}
                  </v-chip>
                  <v-icon end size="small">mdi-menu-down</v-icon>
                </v-btn>
              </template>
              <v-card min-width="240">
                <v-list density="compact">
                  <v-list-item v-for="k in dsKenh" :key="k" @click="doiChon(fKenh, k)">
                    <template #prepend>
                      <v-checkbox-btn :model-value="fKenh.includes(k)" density="compact" />
                    </template>
                    <v-list-item-title class="text-body-2">{{ k }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-card>
            </v-menu>

            <!-- Nhãn (chỉ tab phân loại) -->
            <v-menu v-if="tabHienTai === 'phan-loai'" :close-on-content-click="false">
              <template #activator="{ props }">
                <v-btn v-bind="props" variant="outlined" size="small" class="loc-nut">
                  Nhãn
                  <v-chip v-if="fNhan.length" size="x-small" color="primary" variant="flat" class="ml-2">
                    {{ fNhan.length }}
                  </v-chip>
                  <v-icon end size="small">mdi-menu-down</v-icon>
                </v-btn>
              </template>
              <v-card min-width="220">
                <v-list density="compact">
                  <v-list-item v-for="n in dsNhan" :key="n" @click="doiChon(fNhan, n)">
                    <template #prepend>
                      <v-checkbox-btn :model-value="fNhan.includes(n)" density="compact" />
                    </template>
                    <v-list-item-title class="text-body-2">{{ n }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-card>
            </v-menu>

            <!-- Điểm (chỉ tab CSKH) — slider nằm trong menu nên không đẩy layout -->
            <v-menu v-else :close-on-content-click="false">
              <template #activator="{ props }">
                <v-btn v-bind="props" variant="outlined" size="small" class="loc-nut">
                  {{ locDiem ? `Điểm ${khoangDiem[0]}–${khoangDiem[1]}` : 'Điểm' }}
                  <v-icon end size="small">mdi-menu-down</v-icon>
                </v-btn>
              </template>
              <v-card min-width="300" class="pa-4">
                <div class="text-body-2 font-weight-medium mb-3">
                  Từ {{ khoangDiem[0] }} đến {{ khoangDiem[1] }} điểm
                </div>
                <v-range-slider
                  v-model="khoangDiem"
                  :min="0"
                  :max="100"
                  :step="5"
                  density="compact"
                  thumb-label
                  hide-details
                />
                <div class="d-flex justify-end mt-3">
                  <v-btn size="small" variant="text" @click="khoangDiem = [0, 100]">Đặt lại</v-btn>
                </div>
              </v-card>
            </v-menu>

            <!-- Thời gian: mốc + preset + 2 ô ngày, gộp trong một menu -->
            <v-menu :close-on-content-click="false">
              <template #activator="{ props }">
                <v-btn v-bind="props" variant="outlined" size="small" class="loc-nut">
                  <v-icon start size="small">mdi-calendar</v-icon>
                  {{ nhanThoiGian }}
                  <v-icon end size="small">mdi-menu-down</v-icon>
                </v-btn>
              </template>
              <v-card min-width="330" class="pa-4">
                <v-btn-toggle v-model="fMocNgay" density="compact" variant="outlined" divided mandatory class="mb-3 w-100">
                  <v-btn value="conv" size="small" class="flex-grow-1">Ngày hội thoại</v-btn>
                  <v-btn value="eval" size="small" class="flex-grow-1">Ngày đánh giá</v-btn>
                </v-btn-toggle>

                <div class="d-flex flex-wrap ga-1 mb-3">
                  <v-chip
                    v-for="p in presets"
                    :key="p.value"
                    size="small"
                    :variant="preset === p.value ? 'flat' : 'outlined'"
                    :color="preset === p.value ? 'primary' : ''"
                    @click="apDungPreset(p.value)"
                  >{{ p.label }}</v-chip>
                </div>

                <div class="d-flex ga-2">
                  <v-text-field v-model="tuNgay" type="date" density="compact" variant="outlined" label="Từ ngày" hide-details @update:model-value="preset = 'custom'" />
                  <v-text-field v-model="denNgay" type="date" density="compact" variant="outlined" label="Đến ngày" hide-details @update:model-value="preset = 'custom'" />
                </div>
              </v-card>
            </v-menu>

            <!-- Sắp xếp -->
            <v-menu>
              <template #activator="{ props }">
                <v-btn v-bind="props" variant="outlined" size="small" class="loc-nut">
                  <v-icon start size="small">mdi-sort</v-icon>
                  {{ sapXep }}
                  <v-icon end size="small">mdi-menu-down</v-icon>
                </v-btn>
              </template>
              <v-list density="compact">
                <v-list-item v-for="s in dsSapXep" :key="s" @click="sapXep = s">
                  <v-list-item-title class="text-body-2">{{ s }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>

            <v-btn v-if="coLoc" size="small" variant="text" color="grey-darken-1" @click="xoaLoc">
              Xóa lọc
            </v-btn>
          </div>

          <!-- Hàng chip kết quả + chuyển chế độ xem -->
          <div class="d-flex align-center justify-space-between ga-2 mb-3">
            <div class="d-flex ga-2 hang-chip">
              <template v-if="tabHienTai === 'cskh'">
                <v-chip size="small" color="primary" variant="flat">Tất cả: 2.562</v-chip>
                <v-chip size="small" variant="outlined">Không đạt: 898</v-chip>
                <v-chip size="small" variant="outlined">Đạt: 1.119</v-chip>
                <v-chip size="small" variant="outlined">Bỏ qua: 541</v-chip>
              </template>
              <template v-else>
                <v-chip size="small" color="secondary" variant="flat">Đã phân loại: 1.842</v-chip>
                <v-chip size="small" variant="outlined">Tất cả: 2.104</v-chip>
                <v-chip size="small" variant="outlined">Bỏ qua: 262</v-chip>
              </template>
            </div>
            <v-btn-toggle v-if="mdAndUp" v-model="cheDoXem" density="compact" variant="outlined" divided mandatory>
              <v-btn value="card" size="small"><v-icon size="small">mdi-format-list-bulleted</v-icon></v-btn>
              <v-btn value="table" size="small"><v-icon size="small">mdi-table</v-icon></v-btn>
            </v-btn-toggle>
          </div>

          <!-- Chưa chạy lần nào -->
          <v-card v-if="kichBan === 'chua-chay'" class="pa-10 text-center">
            <v-icon size="48" color="grey-lighten-1">mdi-play-circle-outline</v-icon>
            <div class="text-subtitle-1 font-weight-bold mt-3">Tác vụ này chưa có kết quả</div>
            <div class="text-body-2 text-grey mt-1 mb-4">
              Công ty đã có tác vụ loại này nhưng chưa chạy lần nào.
            </div>
            <v-btn color="primary" prepend-icon="mdi-play">Chạy tác vụ ngay</v-btn>
          </v-card>

          <!-- Bảng: cột quan trọng đứng trước -->
          <v-card v-else-if="xemBang">
            <v-table density="compact" hover>
              <thead>
                <tr>
                  <th style="min-width: 130px">Khách hàng</th>
                  <template v-if="tabHienTai === 'cskh'">
                    <th style="width: 110px">Kết quả</th>
                    <th style="width: 70px" class="text-right">Điểm</th>
                    <th style="width: 34%">Vấn đề</th>
                  </template>
                  <th v-else style="width: 34%">Nhãn</th>
                  <th style="width: 105px">Ngày hội thoại</th>
                  <th style="width: 170px" class="d-none d-lg-table-cell">Tác vụ</th>
                  <th style="width: 135px" class="d-none d-lg-table-cell">Kênh</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in dong" :key="d.ten" style="cursor: pointer">
                  <td class="font-weight-medium">{{ d.ten }}</td>
                  <template v-if="tabHienTai === 'cskh'">
                    <td>
                      <v-chip size="x-small" :color="mauKetQua(d.ketQua)" variant="tonal">{{ d.ketQua }}</v-chip>
                    </td>
                    <td class="text-right">{{ d.diem }}</td>
                    <td class="text-body-2">{{ d.vanDe }}</td>
                  </template>
                  <td v-else class="text-body-2">{{ d.nhan }}</td>
                  <td class="text-body-2 text-grey-darken-1" style="white-space: nowrap">{{ d.ngay }}</td>
                  <td class="text-body-2 text-grey-darken-1 d-none d-lg-table-cell">{{ d.tacVu }}</td>
                  <td class="text-body-2 text-grey-darken-1 d-none d-lg-table-cell">{{ d.kenh }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-card>

          <!-- Card -->
          <div v-else>
            <v-card v-for="d in dong" :key="d.ten" class="mb-3 pa-4">
              <div class="d-flex align-center ga-2">
                <span class="font-weight-medium text-truncate">{{ d.ten }}</span>
                <v-spacer />
                <v-icon size="small" color="grey">mdi-chevron-down</v-icon>
              </div>
              <div class="d-flex align-center flex-wrap ga-2 mt-2 mb-2">
                <v-chip
                  v-if="tabHienTai === 'cskh'"
                  size="x-small"
                  :color="mauKetQua(d.ketQua)"
                  variant="tonal"
                >{{ d.ketQua }}</v-chip>
                <v-chip v-if="tabHienTai === 'cskh' && d.diem !== '—'" size="x-small" variant="tonal">
                  {{ d.diem }}/100
                </v-chip>
                <span class="text-caption text-grey">{{ d.ngay }}</span>
              </div>
              <div class="text-body-2 text-grey-darken-2 mb-2">
                {{ tabHienTai === 'cskh' ? d.vanDe : d.nhan }}
              </div>
              <div class="text-caption text-grey">{{ d.tacVu }} · {{ d.kenh }}</div>
            </v-card>
          </div>

          <div v-if="kichBan !== 'chua-chay'" class="d-flex justify-center mt-4">
            <v-pagination :length="5" :model-value="1" density="compact" total-visible="5" />
          </div>
        </template>

        <!-- Bảng lọc trên mobile -->
        <v-bottom-sheet v-model="moLocMobile">
          <v-card>
            <v-card-title class="d-flex align-center text-subtitle-1">
              Bộ lọc
              <v-spacer />
              <v-btn icon variant="text" size="small" @click="moLocMobile = false">
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </v-card-title>
            <v-divider />
            <v-card-text class="pt-4" style="max-height: 70vh; overflow-y: auto">
              <v-select
                v-model="fTacVu"
                :items="dsTacVu"
                label="Tác vụ"
                density="compact"
                variant="outlined"
                multiple
                chips
                class="mb-3"
                hide-details
              />
              <v-select
                v-model="fKenh"
                :items="dsKenh"
                label="Kênh chat"
                density="compact"
                variant="outlined"
                multiple
                chips
                class="mb-3"
                hide-details
              />
              <v-select
                v-if="tabHienTai === 'phan-loai'"
                v-model="fNhan"
                :items="dsNhan"
                label="Nhãn phân loại"
                density="compact"
                variant="outlined"
                multiple
                chips
                class="mb-3"
                hide-details
              />
              <template v-else>
                <div class="text-body-2 mb-1">Điểm: {{ khoangDiem[0] }} – {{ khoangDiem[1] }}</div>
                <v-range-slider
                  v-model="khoangDiem"
                  :min="0"
                  :max="100"
                  :step="5"
                  density="compact"
                  thumb-label
                  hide-details
                  class="mb-3 px-1"
                />
              </template>

              <div class="text-body-2 mb-1">Thời gian</div>
              <v-btn-toggle v-model="fMocNgay" density="compact" variant="outlined" divided mandatory class="mb-3 w-100">
                <v-btn value="conv" size="small" class="flex-grow-1">Ngày hội thoại</v-btn>
                <v-btn value="eval" size="small" class="flex-grow-1">Ngày đánh giá</v-btn>
              </v-btn-toggle>
              <div class="d-flex flex-wrap ga-1 mb-3">
                <v-chip
                  v-for="p in presets"
                  :key="p.value"
                  size="small"
                  :variant="preset === p.value ? 'flat' : 'outlined'"
                  :color="preset === p.value ? 'primary' : ''"
                  @click="apDungPreset(p.value)"
                >{{ p.label }}</v-chip>
              </div>
              <div class="d-flex ga-2 mb-3">
                <v-text-field v-model="tuNgay" type="date" density="compact" variant="outlined" label="Từ ngày" hide-details @update:model-value="preset = 'custom'" />
                <v-text-field v-model="denNgay" type="date" density="compact" variant="outlined" label="Đến ngày" hide-details @update:model-value="preset = 'custom'" />
              </div>

              <v-select
                v-model="sapXep"
                :items="dsSapXep"
                label="Sắp xếp"
                density="compact"
                variant="outlined"
                hide-details
              />
            </v-card-text>
            <v-divider />
            <v-card-actions>
              <v-btn variant="text" @click="xoaLoc">Xóa lọc</v-btn>
              <v-spacer />
              <v-btn color="primary" variant="flat" @click="moLocMobile = false">Xem kết quả</v-btn>
            </v-card-actions>
          </v-card>
        </v-bottom-sheet>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDisplay } from 'vuetify'

const { mdAndUp } = useDisplay()
const moLocMobile = ref(false)

const kichBan = ref<'ca-hai' | 'chi-phan-loai' | 'chi-cskh' | 'chua-chay' | 'trong'>('ca-hai')
const tab = ref<'cskh' | 'phan-loai'>('cskh')
const cheDoXem = ref<'card' | 'table'>('table')

const tuKhoa = ref('')
const fTacVu = ref<string[]>([])
const fKenh = ref<string[]>([])
const fNhan = ref<string[]>([])
const fMocNgay = ref<'conv' | 'eval'>('conv')
const khoangDiem = ref<[number, number]>([0, 100])
const sapXep = ref('Mới nhất')
const preset = ref('28days')
const tuNgay = ref('2026-08-19')
const denNgay = ref('2026-09-16')

const dsKenh = ['Livechat SePay', 'Zalo OA SePay', 'Fanpage 123HOST']
const dsNhan = ['Hỏi giá', 'Khiếu nại', 'Hỗ trợ kỹ thuật', 'Đặt hàng']
const dsSapXep = ['Mới nhất', 'Điểm thấp nhất', 'Điểm cao nhất']
const presets = [
  { label: 'Hôm nay', value: 'today' },
  { label: '7 ngày', value: '7days' },
  { label: '28 ngày', value: '28days' },
  { label: 'Tháng này', value: 'month' },
]

// Tab chỉ hiện khi công ty có cả hai loại tác vụ
const hienTab = computed(() => kichBan.value === 'ca-hai' || kichBan.value === 'chua-chay')

// Công ty chỉ có 1 loại thì vào thẳng loại đó, không có tab rỗng
const tabHienTai = computed(() => {
  if (kichBan.value === 'chi-phan-loai') return 'phan-loai'
  if (kichBan.value === 'chi-cskh') return 'cskh'
  return tab.value
})

const dsTacVu = computed(() =>
  tabHienTai.value === 'cskh'
    ? ['Chất lượng trực Livechat', 'Chất lượng Zalo OA']
    : ['Phân loại nhu cầu khách', 'Phân loại khiếu nại']
)

const locDiem = computed(() => khoangDiem.value[0] !== 0 || khoangDiem.value[1] !== 100)
// Mobile luôn xem dạng card — bảng nhiều cột không đọc được trên màn hẹp
const xemBang = computed(() => mdAndUp.value && cheDoXem.value === 'table')

const soLoc = computed(
  () => fTacVu.value.length + fKenh.value.length + fNhan.value.length + (locDiem.value ? 1 : 0)
)
const coLoc = computed(
  () => !!tuKhoa.value || fTacVu.value.length > 0 || fKenh.value.length > 0 || fNhan.value.length > 0 || locDiem.value
)

const nhanThoiGian = computed(() => {
  const p = presets.find(x => x.value === preset.value)
  const moc = fMocNgay.value === 'conv' ? 'hội thoại' : 'đánh giá'
  if (p) return `${p.label} · ${moc}`
  return `${hienNgay(tuNgay.value)} – ${hienNgay(denNgay.value)} · ${moc}`
})

function hienNgay(s: string) {
  if (!s) return '—'
  const [, m, d] = s.split('-')
  return `${d}/${m}`
}

// Template đã tự bóc ref nên nhận thẳng mảng; sửa tại chỗ vẫn giữ tính phản ứng.
function doiChon(arr: string[], v: string) {
  const i = arr.indexOf(v)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(v)
}

function apDungPreset(v: string) {
  preset.value = v
  const d = new Date(2026, 8, 16)
  const y = d.getFullYear()
  const m = d.getMonth()
  denNgay.value = dinhDang(d)
  if (v === 'today') tuNgay.value = dinhDang(d)
  else if (v === '7days') tuNgay.value = dinhDang(new Date(y, m, d.getDate() - 7))
  else if (v === '28days') tuNgay.value = dinhDang(new Date(y, m, d.getDate() - 28))
  else if (v === 'month') tuNgay.value = dinhDang(new Date(y, m, 1))
}

function dinhDang(d: Date) {
  return d.toISOString().split('T')[0]
}

function xoaLoc() {
  tuKhoa.value = ''
  fTacVu.value = []
  fKenh.value = []
  fNhan.value = []
  khoangDiem.value = [0, 100]
}

function mauKetQua(kq: string) {
  if (kq === 'Đạt') return 'success'
  if (kq === 'Bỏ qua') return 'grey'
  return 'error'
}

const dong = computed(() =>
  tabHienTai.value === 'cskh'
    ? [
        { ten: 'Trọng Nguyên', tacVu: 'Chất lượng trực Livechat', kenh: 'Livechat SePay', ngay: '15/09 23:48', ketQua: 'Không đạt', diem: '45', vanDe: 'Trả lời chậm 18 phút; không chào hỏi đầu hội thoại', nhan: '' },
        { ten: 'Hữu Phước', tacVu: 'Chất lượng trực Livechat', kenh: 'Livechat SePay', ngay: '15/09 17:05', ketQua: 'Không đạt', diem: '62', vanDe: 'Không xác nhận lại nhu cầu trước khi kết thúc', nhan: '' },
        { ten: 'Minh Anh', tacVu: 'Chất lượng Zalo OA', kenh: 'Zalo OA SePay', ngay: '15/09 20:12', ketQua: 'Đạt', diem: '88', vanDe: '—', nhan: '' },
        { ten: 'Thanh Luyện', tacVu: 'Chất lượng trực Livechat', kenh: 'Livechat SePay', ngay: '16/09 06:40', ketQua: 'Bỏ qua', diem: '—', vanDe: 'Khách chỉ gửi 1 tin nhắn có nội dung chính', nhan: '' },
      ]
    : [
        { ten: 'Thanh Luyện', tacVu: 'Phân loại nhu cầu khách', kenh: 'Livechat SePay', ngay: '16/09 06:40', ketQua: '', diem: '', vanDe: '', nhan: 'Hỏi giá' },
        { ten: 'Trọng Nguyên', tacVu: 'Phân loại nhu cầu khách', kenh: 'Livechat SePay', ngay: '15/09 23:48', ketQua: '', diem: '', vanDe: '', nhan: 'Khiếu nại; Hỗ trợ kỹ thuật' },
        { ten: 'Minh Anh', tacVu: 'Phân loại khiếu nại', kenh: 'Zalo OA SePay', ngay: '15/09 20:12', ketQua: '', diem: '', vanDe: '', nhan: 'Đặt hàng' },
        { ten: 'Hữu Phước', tacVu: 'Phân loại nhu cầu khách', kenh: 'Fanpage 123HOST', ngay: '15/09 17:05', ketQua: '', diem: '', vanDe: '', nhan: 'Hỗ trợ kỹ thuật' },
      ]
)
</script>

<style scoped>
/* Hạ chiều cao ô tìm kiếm cho bằng nút lọc (32px) — Vuetify không có prop sẵn cho cỡ này */
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
